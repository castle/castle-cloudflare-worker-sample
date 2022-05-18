const CASTLE_API_SECRET = globalThis.CASTLE_API_SECRET;

// Modify config according to your use case
const CONFIG = {
  triggers: [
    {
      event: {
        type: "$registration", // castle event type
        status: "$attempted", // castle event status
      },
      route: {
        method: "POST", // HTTP method of the matched request
        pathname: "/signup", // pathname of the matched request
      },
      endpoint: "filter",
    },
    {
      event: {
        type: "$custom",
        name: "Start Browsing", // castle event name
      },
      route: {
        method: "GET",
        pathname: "/",
      },
      endpoint: "log",
    },
  ],
  timeout: 2000, // castle api timeout
  scrubbedHeaders: ["cookie", "authorization"], // headers to filter out
  denyResponse: function (request, castleData) {
    return new Response(null, { status: 403, statusText: "denied" });
  },
  extractRequestToken: function (formData, headers) {
    // here we get request token from the form data
    if (formData) {
      return formData.get("castle_request_token");
    }
    // but if token is sent differently eg in headers you can replace this line with
    // return headers.get("Castle-Request-Token");
  },
  extractUserData: function (formData, headers, trigger) {
    let user = {};
    // here we get request token from the form data
    if (formData && formData.get("email")) {
      user.email = formData.get("email");
    }

    return user;
  },
};

class InvalidRequestTokenError extends Error {
  constructor(message) {
    super(message);

    // assign the error class name in your custom error (as a shortcut)
    this.name = this.constructor.name;

    // capturing the stack trace keeps the reference to your error class
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Return prefiltered request headers
 * @param {Headers} requestHeaders
 */
function scrubHeaders(requestHeaders) {
  const headersObject = Object.fromEntries(requestHeaders);

  return Object.keys(headersObject).reduce((accumulator, headerKey) => {
    const isScrubbed = CONFIG.scrubbedHeaders.includes(headerKey.toLowerCase());
    return {
      ...accumulator,
      [headerKey]: isScrubbed ? true : headersObject[headerKey],
    };
  }, {});
}

/**
 * Return timeout promise on the base of the promise
 * @param {number} ms
 * @param {Promise} promise
 */
async function timeout(ms, promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Castle Api Timeout"));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((reason) => {
        clearTimeout(timer);
        reject(reason);
      });
  });
}

/**
 * Return the result of the POST /filter call to Castle API
 * @param {Object} trigger
 * @param {Request} request
 */
async function performRequest(trigger, request) {
  const clonedRequest = await request.clone();
  let formData;
  try {
    formData = await clonedRequest.formData();
  } catch {}

  const requestToken = CONFIG.extractRequestToken(formData, request.headers);

  const requestBody = {
    type: trigger.event.type,
    user: CONFIG.extractUserData(formData, request.headers, trigger),
    properties: {},
    context: {
      ip: request.headers.get("CF-Connecting-IP"),
      headers: scrubHeaders(request.headers),
    },
  };
  if (requestToken) {
    requestBody.request_token = requestToken;
  }
  if (trigger.event.status) {
    requestBody.status = trigger.event.status;
  }
  if (trigger.event.name) {
    requestBody.name = trigger.event.name;
  }

  const authorizationString = btoa(`:${CASTLE_API_SECRET}`);
  const requestOptions = {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorizationString}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  };

  try {
    const response = await timeout(
      CONFIG.timeout,
      fetch(`https://api.castle.io/v1/${trigger.endpoint}`, requestOptions)
    );
    if (response.status === 201) {
      if (trigger.endpoint === "log") {
        return;
      }

      return await response.json();
    } else if (response.status === 422) {
      const body = await response.json();
      if (body && body.type === "invalid_request_token") {
        throw new InvalidRequestTokenError(body.message);
      } else {
        throw "invalid params";
      }
    } else {
      throw "castle error";
    }
  } catch (err) {
    throw err;
  }
}

/**
 * Return matched action or undefined
 * @param {Request} request
 */
function findMatchingRoute(request) {
  const requestUrl = new URL(request.url);
  for (const trigger of CONFIG.triggers) {
    if (
      requestUrl.pathname === trigger.route.pathname &&
      request.method === trigger.route.method
    ) {
      return trigger;
    }
  }
}

/**
 * Process the received request
 * @param {Request} request
 */
async function handleRequest(request) {
  try {
    const trigger = findMatchingRoute(request);

    if (!trigger) {
      // returns the original fetch promise
      return fetch(request);
    }

    const castleResponse = await performRequest(trigger, request);

    if (castleResponse && castleResponse.policy.action === "deny") {
      // defined what to do when deny happens
      return CONFIG.denyResponse(request, castleResponse);
    }

    // returns the original fetch promise
    return fetch(request);
  } catch (err) {
    if (err instanceof InvalidRequestTokenError) {
      // Deny attempt. Likely a bad actor
      return CONFIG.denyResponse(request, null);
    } else {
      // just pass the original fetch promise in case of any other error
      return fetch(request);
    }
  }
}

addEventListener("fetch", (event) => {
  if (!CASTLE_API_SECRET) {
    throw new Error("CASTLE_API_SECRET not provided");
  }
  event.respondWith(handleRequest(event.request));
});

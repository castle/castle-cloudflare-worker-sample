const CASTLE_API_SECRET = globalThis.CASTLE_API_SECRET;

// Modify the routes according to your use case
const routes = [
  {
    eventType: "$registration", // castle event type
    eventStatus: "$attempted", // castle event status
    method: "POST", // HTTP method of the matched request
    pathname: "/users/sign_up", // pathname of the matched request
  },
];

// headers to filter out
const SCRUBBED_HEADERS = ["cookie", "authorization"];

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
    const isScrubbed = SCRUBBED_HEADERS.includes(headerKey.toLowerCase());
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

// castle api timeout
const TIMEOUT = 2000;

/**
 * Return the result of the POST /filter call to Castle API
 * @param {Request} request
 */
async function filterRequest(eventType, eventStatus, request) {
  const clonedRequest = await request.clone();
  const formData = await clonedRequest.formData();
  let user = {};
  let properties = {};

  const requestToken = formData.get("castle_request_token");

  // here you can include form data as a part of the event metadata
  // if (formData.get('email')) {
  //  user.email = formData.get('email');
  // }
  // if (formData.get('company')) {
  //   properties.company_name = formData.get('company');
  // }

  const requestBody = JSON.stringify({
    type: eventType,
    status: eventStatus,
    request_token: requestToken,
    user: user,
    properties: properties,
    context: {
      ip: request.headers.get("CF-Connecting-IP"),
      headers: scrubHeaders(request.headers),
    },
  });

  const authorizationString = btoa(`:${CASTLE_API_SECRET}`);
  const requestOptions = {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorizationString}`,
      "Content-Type": "application/json",
    },
    body: requestBody,
  };

  try {
    const response = await timeout(
      TIMEOUT,
      fetch("https://api.castle.io/v1/filter", requestOptions)
    );
    if (response.status === 201) {
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
  for (const route of routes) {
    if (
      requestUrl.pathname === route.pathname &&
      request.method === route.method
    ) {
      return route;
    }
  }
}

function denyResponse(request) {
  return Response.redirect(`${request.url}`);
}

/**
 * Process the received request
 * @param {Request} request
 */
async function handleRequest(request) {
  if (!CASTLE_API_SECRET) {
    throw new Error("CASTLE_API_SECRET not provided");
  }

  try {
    const route = findMatchingRoute(request);

    if (!route) {
      return await fetch(request);
    }

    const castleResponseJSON = await filterRequest(
      route.eventType,
      route.eventStatus,
      request
    );

    if (castleResponseJSON && castleResponseJSON.policy.action === "deny") {
      // defined what to do when deny happens
      return denyResponse(request);
    }

    // proceed with the original fetch
    return fetch(request);
  } catch (err) {
    if (err instanceof InvalidRequestTokenError) {
      // IMPLEMENT: Deny attempt. Likely a bad actor
      // rethrow error to handle in the further catch
      return denyResponse(request);
    } else {
      // just pass the promise in case of any error
      return fetch(request);
    }
  }
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

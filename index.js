const CASTLE_API_SECRET = globalThis.CASTLE_API_SECRET;

// Modify the routes according to your use case
const routes = [
  {
    eventType: "$registration", // castle event type
    method: "POST", // HTTP method of the matched request
    pathname: "/users/sign_up", // pathname of the matched request
  },
];

// headers to filter out
const SCRUBBED_HEADERS = ["cookie", "authorization"];

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
async function filterRequest(eventType, request) {
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
    } else {
      throw "castle error";
    }
  } catch (err) {
    // log or rethrow error if needed here
    return;
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
      return fetch(request);
    }

    const castleResponseJSON = await filterRequest(route.eventType, request);

    if (castleResponseJSON && castleResponseJSON.policy.action === "deny") {
      // defined what to do when deny happens
      return Response.redirect(`${request.url}`);
    }

    // proceed with the original fetch
    return await fetch(request);
  } catch (error) {
    // log additional errors here
    // just pass the promise in case of any error
    return fetch(request);
  }
}

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

// Modify the routes according to your use case
const routes = [
  {
    // Castle event
    event: '$registration',
    // function to be executed if the route is matched
    handler: authenticate,
    // HTTP method of the matched request
    method: 'POST',
    // pathname of the matched request
    pathname: '/users/sign_up',
  },
];

/**
 * Return object containing Castle Auth Headers
 */
function generateCastleAuthHeaders() {
  return {
    Authorization: `Basic ${btoa(`:${CASTLE_API_SECRET}`)}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Return the castle_token fetched from form data
 * @param {Request} request
 */
async function getCastleTokenFromRequest(request) {
  const clonedRequest = await request.clone();
  const formData = await clonedRequest.formData();
  if (formData) {
    return formData.get('castle_token');
  }
}

/**
 * Return the result of the POST /authenticate call to Castle API
 * @param {Request} request
 */
async function authenticate(event, request) {
  const clientId = await getCastleTokenFromRequest(request);

  const requestBody = JSON.stringify({
    event,
    context: {
      client_id: clientId,
      ip: request.headers.get('CF-Connecting-IP'),
      user_agent: request.headers.get('User-Agent'),
    },
  });

  const requestOptions = {
    method: 'POST',
    headers: generateCastleAuthHeaders(),
    body: requestBody,
  };
  let response;
  try {
    response = await fetch(
      'https://api.castle.io/v1/authenticate',
      requestOptions
    );
  } catch (err) {
    console.log(err);
  }
  return response;
}

/**
 * Return matched action or undefined
 * @param {Request} request
 */
async function processRequest(request) {
  const requestUrl = new URL(request.url);
  for (const route of routes) {
    if (
      requestUrl.pathname === route.pathname &&
      request.method === route.method
    ) {
      return route.handler(route.event, request);
    }
  }
}

/**
 * Process the received request
 * @param {Request} request
 */
async function handleRequest(request) {
  if (!CASTLE_API_SECRET) {
    throw new Error('CASTLE_API_SECRET not provided');
  }

  const result = await processRequest(request);

  if (result && result.risk > 0.9) {
    return new Response('Blocked!', { status: 403 });
  }

  return fetch(request);
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

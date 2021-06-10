const CASTLE_API_SECRET = globalThis.CASTLE_API_SECRET;
const CASTLE_APP_ID = globalThis.CASTLE_APP_ID;

// Modify the routes according to your use case
const routes = [
  {
    // Castle event
    event: '$registration', // function to be executed if the route is matched
    handler: filterRequest, // HTTP method of the matched request
    method: 'POST', // pathname of the matched request
    pathname: '/users/sign_up',
  },
];

/**
 * Generate HTML response
 */
function generateHTMLResponse() {
  return `
  <html>
    <head>
      <link rel="icon" href="data:,">
      <script src="https://d2t77mnxyo7adj.cloudfront.net/v1/c.js?${CASTLE_APP_ID}"></script>

      <script>
        window.onload = function() {
          var form = document.getElementById('registration-form');

          form.addEventListener('submit', function(evt) {
            evt.preventDefault();

            // Get the one-time request token from Castle
            _castle('createRequestToken').then(function(token){

              // Populate a hidden <input> field named 'castle_request_token'
              var hiddenInput = document.createElement('input');
              hiddenInput.setAttribute('type', 'hidden');
              hiddenInput.setAttribute('name', 'castle_request_token');
              hiddenInput.setAttribute('value', token);

              // Add the 'castle_request_token' to the HTML form
              form.appendChild(hiddenInput);

              form.submit();
            });

          });
        }
      </script>
    </head>

  <body>
    <form action= "/users/sign_up" method="POST" id="registration-form">
      <label for="email">Email</label>
      <input type="text" name= "email"><br><br>
      <input type="submit" value= "submit">
  </body>
  </html>
`;
}

/**
 * Return prefiltered request headers
 * @param {Headers} requestHeaders
 * @param {string[]} scrubbedHeaders
 */
function scrubHeaders(requestHeaders, scrubbedHeaders) {
  const headersObject = Object.fromEntries(requestHeaders);
  return Object.keys(headersObject).reduce((accumulator, headerKey) => {
    const isScrubbed = scrubbedHeaders.includes(headerKey.toLowerCase());
    return {
      ...accumulator,
      [headerKey]: isScrubbed ? true : headersObject[headerKey],
    };
  }, {});
}

/**
 * Return the result of the POST /filter call to Castle API
 * @param {Request} request
 */
async function filterRequest(event, request) {

  const clonedRequest = await request.clone();
  const formData = await clonedRequest.formData();

  requestToken = formData.get('castle_request_token');
  email = formData.get('email');

  const requestBody = JSON.stringify({
    event,
    request_token: requestToken,
    user: {
      email: email // optional
    },
    context: {
      ip: request.headers.get('CF-Connecting-IP'),
      headers: scrubHeaders(request.headers, ['cookie', 'authorization']),
    },
  });

  const requestOptions = {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`:${CASTLE_API_SECRET}`)}`,
      'Content-Type': 'application/json',
    },
    body: requestBody,
  };
  let response;
  try {
    response = await fetch('https://api.castle.io/v1/filter', requestOptions);
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

  const requestUrl = new URL(request.url);

  if (requestUrl.pathname === '/') {
    if (!CASTLE_APP_ID) {
      throw new Error('CASTLE_APP_ID not provided');
    }
    return new Response(generateHTMLResponse(), {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    });
  }

  const castleResponse = await processRequest(request);
  const castleResponseJSON = await castleResponse.json();
  const castleResponseJSONString = JSON.stringify(castleResponseJSON);

  if (castleResponseJSON && castleResponseJSON.policy.action === 'deny') {
    return new Response(castleResponseJSONString, { status: 403 });
  }

  // Respond with result fetched from Castle API or fetch the request
  // return fetch(request);
  return new Response(castleResponseJSONString, { status: 200 });
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

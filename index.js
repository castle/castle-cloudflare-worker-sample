const CASTLE_API_SECRET = globalThis.CASTLE_API_SECRET;
const CASTLE_APP_ID = globalThis.CASTLE_APP_ID;

// Modify the routes according to your use case
const routes = [
  {
    // Castle event
    event: '$registration', // function to be executed if the route is matched
    method: 'POST', // HTTP method of the matched request
    pathname: '/users/sign_up', // pathname of the matched request
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
 */
function scrubHeaders(requestHeaders) {
  const scrubbedHeaders = ['cookie', 'authorization'];
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
 * Return timeout promise on the base of the promise
 * @param {number} ms
 * @param {Promise} promise
 */
async function timeout(ms, promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Castle Api Timeout'));
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
 * @param {Request} request
 */
async function filterRequest(event, request) {
  const clonedRequest = await request.clone();
  const formData = await clonedRequest.formData();
  let user = {};

  requestToken = formData.get('castle_request_token');

  if (formData.get('email')) {
    user.email = formData.get('email');
  }

  const requestBody = JSON.stringify({
    event,
    request_token: requestToken,
    user: user,
    context: {
      ip: request.headers.get('CF-Connecting-IP'),
      headers: scrubHeaders(request.headers),
    },
  });

  const authorizationString = btoa(`:${CASTLE_API_SECRET}`);
  const requestOptions = {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorizationString}`,
      'Content-Type': 'application/json',
    },
    body: requestBody,
  };

  try {
    const response = await timeout(
      3000,
      fetch('https://api.castle.io/v1/filter', requestOptions)
    );
    return response.json();
  } catch (err) {
    // customized failover response
    return {
      policy: {
        action: 'allow',
      },
      failover: true,
    };
  }
}

/**
 * Return matched action or undefined
 * @param {string} requestUrl
 */
function findMatchingRoute(requestUrl) {
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
    throw new Error('CASTLE_API_SECRET not provided');
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.pathname === '/') {
    // render page with the form
    if (!CASTLE_APP_ID) {
      throw new Error('CASTLE_APP_ID not provided');
    }
    return new Response(generateHTMLResponse(), {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    });
  }

  const route = findMatchingRoute(requestUrl);

  if (!route) {
    // return fetch(request);
    return new Response('', { status: 403 });
  }

  const castleResponseJSON = await filterRequest(route.event, request);

  if (castleResponseJSON && castleResponseJSON.policy.action === 'deny') {
    const castleResponseJSONString = JSON.stringify(castleResponseJSON);

    return new Response(castleResponseJSONString, { status: 403 });
  }

  // Respond with result fetched from Castle API or fetch the request
  // return fetch(request);
  return new Response(castleResponseJSONString, { status: 200 });
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

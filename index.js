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

const castleConfig = {
  riskThreshold: 0.9,
  url: "https://api.castle.io/v1/authenticate?include=risk"
}

const html = `
<html>
<head>
<script src="https://d2t77mnxyo7adj.cloudfront.net/v1/c.js?${CASTLE_APP_ID}"></script>

<script>
window.onload = function() {
  var form = document.getElementById('registration-form');

  form.addEventListener("submit", function(evt) {
    evt.preventDefault()

    // Get the ClientID token
    var clientId = _castle('getClientId');

    // Populate a hidden <input> field named "castle_client_id"
    var hiddenInput = document.createElement('input');
    hiddenInput.setAttribute('type', 'hidden');
    hiddenInput.setAttribute('name', 'castle_client_id');
    hiddenInput.setAttribute('value', clientId);

    // Add the "castle_client_id" to the HTML form
    form.appendChild(hiddenInput);

    form.submit()
  });
}
</script>
</head>

<body>
  <p>please register!</p>
  <form action = "/users/sign_up" method="POST" id="registration-form">
    <label for = "username">username</label>
    <input type = "text" name = "username"><br><br>
    <input type = "submit" value = "submit">
</body>
</html>
`

const castleAuthHeaders = {
  Authorization: `Basic ${btoa(`:${CASTLE_API_SECRET}`)}`,
  'Content-Type': 'application/json',
};

/**
 * Return the castle_token fetched from form data
 * @param {Request} request
 */
async function getCastleTokenFromRequest(request) {
  const clonedRequest = await request.clone();
  const formData = await clonedRequest.formData();
  if (formData) {
    return formData.get('castle_client_id');
  }
}

/**
 * Return the result of the POST /authenticate call to Castle API
 * @param {Request} request
 */
async function authenticate(event, request) {

  console.log("reached the authenticate function.")

  const clientId = await getCastleTokenFromRequest(request);

  console.log("the client id is: " + clientId)

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
    headers: castleAuthHeaders,
    body: requestBody,
  };
  let response;
  try {
    response = await fetch(castleConfig.url, requestOptions);
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

  // to prevent annoying 500 errors in dev
  if (requestUrl.pathname === "/favicon.ico") {
    return new Response('', { status: 200 });
  }

  if (requestUrl.pathname === "/") {
    if (!CASTLE_APP_ID) {
      throw new Error('CASTLE_APP_ID not provided');
    }
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    })
  }

  const result = await processRequest(request);

  const r = await result.json()

  const s = JSON.stringify(r)

  console.log("************************")

  console.log(s)

  if (r && r.risk > castleConfig.riskThreshold) {
    return new Response(s, { status: 403 });
  }

  // dev
  return new Response(s, { status: 200 });

  // prod
  // return fetch(request);
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

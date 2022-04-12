<div align="center">
  <img align="center" alt="Castle logo" src='./assets/castle-logo.png' width='150'/>
</div>
<div align="center">
  <h1>Castle Cloudflare Worker Sample</h1>
</div>
<div align="center">
  <image alt="Package version" src="https://img.shields.io/github/package-json/v/castle/castle-cloudflare-worker-sample"/>
  <image alt="License" src="https://img.shields.io/github/license/castle/castle-cloudflare-worker-sample"/>
</div>

## Overview

The Castle Cloudflare Worker allows you to put Castle's risk engine right on the edge, in a Cloudflare worker.

## How it works

Once you've installed the worker and configured the `CASTLE_API_SECRET`, the worker will listen for POSTs to the `/users/sign_up` route.

The POST must include a Castle `request_token`, and optionally an `email` field that is used map events to existing users.

When the worker receives the POST, it will in turn make a POST to Castle, and receive a risk score in return. If result has `deny` action, then the worker will respond with a defined response. Otherwise worker with simply forward the request to the upstream.

## Prerequisites

You'll need a Castle account and a Cloudflare account to get started.

Additionally you need to have castle script integrated with your registration form [https://docs.castle.io/docs/sdk-browser#configuration](https://docs.castle.io/docs/sdk-browser#configuration)

### Castle

If you don't have a Castle account already, you can [set up a free trial](https://dashboard.castle.io/signup/new). You will need your Castle API Secret, which can be found in the Settings section of your Castle dashboard.

### Cloudflare

If you're going to use the `Deploy with Workers` option (see below), you'll need your Cloudflare account ID and an API Token.

## Installation

There are two options for installing this worker, a "manual" method and a `Deploy with Workers` method.

### Manual installation

1. Create or open the Cloudflare worker where you would like to install the Castle worker code.

2. Add Environment Variable to your worker:

   - `CASTLE_API_SECRET` — assign your Castle API Key to this variable.

   You can retrieve your `CASTLE_API_SECRET` from [the settings section of your Castle dashboard](https://dashboard.castle.io/settings/general).

3. Copy and paste the contents of the `index.js` file in this repo to your Worker.

4. Customize for your needs

5. Preview/Save and deploy!

### Installation using `Deploy with Workers`

Press the `Deploy with Workers` button. You will be redirected to a dedicated deployment page.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/castle/castle-cloudflare-worker-sample)

### Detailed Installation steps

1. Authorize GitHub with Workers

   Authorization allows to fork the project from Github and deploy it after finishing the setup.

2. Configure Cloudflare Account

   Add Cloudflare Account ID (`CF_ACCOUNT_ID`) and Cloudflare API Token with "Edit Workers" permissions (`CF_API_TOKEN`). They will be auto-uploaded as Github actions secrets.

   After this step, `castle-cloudflare-worker-sample` repository should be forked to your organization.

3. Deploy with GitHub Actions

   Navigate to `Settings > Secrets` tab of the forked repository.

   Update `Repository Secrets` — add Castle API secret available in [Castle Dashboard](https://dashboard.castle.io/settings/general) as `CASTLE_API_SECRET` to Github actions secrets.

   Now you can finalize the deployment by pressing the `Deploy` button.

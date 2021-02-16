<div align="center">
  <img align="center" alt="Castle logo" src='./assets/castle-logo.svg' width='150'/>
</div>
<div align="center">
  <h1>Castle Cloudflare Worker Demo</h1>
</div>
<div align="center">
  <image alt="Build status" src="https://img.shields.io/github/workflow/status/castle/cloudflare-worker-demo/Build"/>
  <image alt="Package version" src="https://img.shields.io/github/package-json/v/castle/castle-cloudflare-worker-demo"/>
  <image alt="License" src="https://img.shields.io/github/license/castle/castle-cloudflare-worker-demo"/>
</div>

## Installation

Press the `Deploy with Workers` button. You will be redirected to a dedicated deployment page.

  [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/castle/castle-cloudflare-worker-demo)

### Installation steps

1. Authorize GitHub with Workers

    Authorization allows to fork the project from Github and deploy it after finishing the setup.

2. Configure Cloudflare Account

    Add Cloudflare Account ID (`CF_ACCOUNT_ID`) and Cloudflare API Token with "Edit Workers" permissions (`CF_API_TOKEN`). They will be auto-uploaded as Github actions secrets.

    After this step, `castle-cloudflare-worker-demo` repository should be forked to your organization.

3. Deploy with GitHub Actions

    Navigate to `Settings > Secrets` tab of the forked repository. Update `Repository Secrets` — add Castle API secret, available in [Castle Dashboard](https://dashboard.castle.io/settings/general) as `CASTLE_API_SECRET` to Github actions secrets.

    Now you can finalize the deployment by pressing the `Deploy` button.

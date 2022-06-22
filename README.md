# Let's eSign API Server

![13-arch](https://user-images.githubusercontent.com/2587360/174950313-6750ce11-2c81-453c-9319-179c951f3b14.png)

## Introduction

Let's eSign API Server is an open-source confidential eSigning API server for you to deploy at your site. It can be viewed as a normal API server integrated with a *PDF Processor* and an *API Proxy* connecting to the confidential eSigning service [Let's eSign](https://letsesign.org) which operates [Let's eSign Enclave](https://github.com/letsesign/letsesign-enclave) on the public cloud.

Let's eSign API Server comes with a built-in web app named Let's eSign Sender. Let's eSign Sender is not only a showcase of Let's eSign API Server's capabilities but also ready for production use. Currently, the web app UI supports
- Single and multiple signers
- Specific signing orders
- Bulk signing requests
- Document templates
- SMS-based signer authentication

When deployed at your site, Let's eSign API Server will encrypt your users' documents before sending them to the isolated Let's eSign Enclave, which can then decrypt and process your users' documents in a confidential manner.

## How to deploy

**To deploy Let's eSign API Server, you need to [register your root domain with Let's eSign](https://github.com/letsesign/letsesign-docs/blob/main/HOWTO-register.md) first in order to get the required `env.list` file which encapsulates the API key.**

Depending on your choice there are two ways to deploy Let's eSign API Server:

### A. Deploy the pre-built docker image

1. Copy the `env.list` file that you obtained during the registration process to the current directory. By default, the Let's eSign Sender integration is enable. (You can disable it by setting `webApp=off` in `env.list` if you solely want to use the API server.)

2. Next, run the following:

    ```
    docker run -d -p 80:80 --env-file ./env.list letsesign/letsesign-api-server
    ```

3. Now you can access Let's eSign Sender at `http://localhost` using your browser, and can make API calls to Let's eSign API Server at `http://localhost` too.

### B. Build and then deploy

1. Get ready the aforementioned `env.list` file.

2. Next, build the docker image:

    ```
    git clone https://github.com/letsesign/letsesign-api-server.git
    cd letsesign-api-server
    docker build -t letsesign-api-server .
    ```

3. Next, run the following at where `env.list` is stored:

    ```
    docker run -d -p 80:80 --env-file ./env.list letsesign-api-server
    ```
 
4. Now you can access Let's eSign Sender at `http://localhost` using your browser, and can make API calls to Let's eSign API Server at `http://localhost` too.

## How to make API calls

Please check [Let's eSign API Server Examples](https://github.com/letsesign/letsesign-api-server-examples) for details.

## How to enable Auth0 integration

Let's eSign Sender comes with integration with [Auth0](https://auth0.com/) which allows you to authenticate your users by various means (e.g., Office 365 Login, Google Login). To enable Auth0 authentication, first you need to get into the container shell by the following:

```
docker exec -it YOUR_CONTAINER_ID bash
```

Then you just need to edit `auth0-config.json` file with your Auth0 parameters and restart the web server by the following:

```
pm2 restart all
```
Note the `authRequired` parameter in `auth0-config.json` has to be `true` for enabling the Auth0 integration.

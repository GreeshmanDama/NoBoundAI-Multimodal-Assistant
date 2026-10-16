import proxy from "express-http-proxy";

export const ProxyWithHeader = (serviceUrl, options = {}) => {
  return proxy(serviceUrl, {
    ...options,

    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      console.log("Proxying request:", srcReq.method, srcReq.originalUrl);
      console.log("Target service:", serviceUrl);

      if (srcReq.user) {
        proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      }

      return proxyReqOpts;
    },
  });
};
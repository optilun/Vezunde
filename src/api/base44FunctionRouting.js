import {
  DIRECTORY_FUNCTION_ROUTES,
  invokeDirectoryFunction,
} from '../../base44/shared/directoryFunctionRouting.js';

export function installBase44FunctionRouting(client) {
  const rawFunctions = client.functions;
  const rawInvoke = rawFunctions.invoke.bind(rawFunctions);
  const routedFunctions = new Proxy(rawFunctions, {
    get(target, property) {
      if (property === 'invoke') {
        return (logicalName, payload = {}) => {
          if (!DIRECTORY_FUNCTION_ROUTES[logicalName]) return rawInvoke(logicalName, payload);
          return invokeDirectoryFunction(client, logicalName, payload);
        };
      }
      return Reflect.get(target, property, target);
    },
  });

  return new Proxy(client, {
    get(target, property) {
      if (property === 'functions') return routedFunctions;
      return Reflect.get(target, property, target);
    },
  });
}

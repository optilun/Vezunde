import {
  DIRECTORY_FUNCTION_ROUTES,
  invokeDirectoryFunction,
} from '../../base44/shared/directoryFunctionRouting.js';
import {
  SERVICE_CONFIGURATION_FUNCTION_ROUTES,
  invokeServiceConfigurationFunction,
} from '../../base44/shared/serviceConfigurationFunctionRouting.js';

export function installBase44FunctionRouting(client) {
  const rawFunctions = client.functions;
  const rawInvoke = rawFunctions.invoke.bind(rawFunctions);
  const routedFunctions = new Proxy(rawFunctions, {
    get(target, property) {
      if (property === 'invoke') {
        return (logicalName, payload = {}) => {
          if (DIRECTORY_FUNCTION_ROUTES[logicalName]) {
            return invokeDirectoryFunction(client, logicalName, payload);
          }
          if (SERVICE_CONFIGURATION_FUNCTION_ROUTES[logicalName]) {
            return invokeServiceConfigurationFunction(client, logicalName, payload);
          }
          return rawInvoke(logicalName, payload);
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

import swarm from "../lib";

/**
 * Retrieves the agent name for a given client ID.
 *
 * @param {string} clientId - The ID of the client.
 * @returns {Promise<string>} The name of the agent.
 * @throws Will throw an error if the client ID is invalid or if the swarm validation fails.
 */
export const getAgentName = async (clientId: string) => {
  swarm.loggerService.log("function getAgentName", {
    clientId,
  });
  swarm.sessionValidationService.validate(clientId, "getAgentName");
  const swarmName = swarm.sessionValidationService.getSwarm(clientId);
  swarm.swarmValidationService.validate(swarmName, "getAgentName");
  return await swarm.swarmPublicService.getAgentName(
    clientId,
    swarmName
  );
};

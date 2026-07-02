/**
 * @typedef {Object} PostCallWebhookEvent
 * @property {string} id
 * @property {string} receivedAt
 * @property {number | undefined} callLogId
 * @property {number | undefined} bulkCallId
 * @property {string | undefined} campaignId
 * @property {string | undefined} campaignName
 * @property {string | undefined} phoneNumber
 * @property {string | undefined} callStatus
 * @property {string | undefined} callDuration
 * @property {string | undefined} callDate
 * @property {string | undefined} sentiment
 * @property {string | undefined} summary
 * @property {Record<string, unknown>} extractedVariables
 * @property {unknown} rawPayload
 */

/**
 * @typedef {Object} RegisteredCampaign
 * @property {string} campaignId
 * @property {string} campaignName
 * @property {number | undefined} bulkCallId
 * @property {number} startedAt
 * @property {string[]} phones
 */

export {};

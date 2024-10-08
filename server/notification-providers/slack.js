const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { getMonitorRelativeURL, UP } = require("../../src/util");
const { Settings } = require("../settings");
const { log } = require("../../src/util");

class Slack extends NotificationProvider {
    name = "slack";

    /**
     * Deprecated property notification.slackbutton
     * Set it as primary base url if this is not yet set.
     * @deprecated
     * @param {string} url The primary base URL to use
     * @returns {Promise<void>}
     */
    static async deprecateURL(url) {
        let currentPrimaryBaseURL = await Settings.get("primaryBaseURL");

        if (!currentPrimaryBaseURL) {
            log.error("notification", "Move the url to be the primary base URL");
            await Settings.set("primaryBaseURL", url, "general");
        } else {
            log.debug("notification", "Already there, no need to move the primary base URL");
        }
    }

    /**
     * Builds the actions available in the slack message
     * @param {string} baseURL Uptime Kuma base URL
     * @param {object} monitorJSON The monitor config
     * @returns {Array} The relevant action objects
     */
    static buildActions(baseURL, monitorJSON) {
        const actions = [];

        if (baseURL) {
            actions.push({
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Visit Uptime Kuma",
                },
                "value": "Uptime-Kuma",
                "url": baseURL + getMonitorRelativeURL(monitorJSON.id),
            });

        }

        const address = this.extractAdress(monitorJSON);
        if (address) {
            actions.push({
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Visit site",
                },
                "value": "Site",
                "url": address,
            });
        }

        return actions;
    }

    /**
     * Builds the different blocks the Slack message consists of.
     * @param {string} baseURL Uptime Kuma base URL
     * @param {object} monitorJSON The monitor object
     * @param {object} heartbeatJSON The heartbeat object
     * @param {string} title The message title
     * @param {string} msg The message body
     * @returns {Array<object>} The rich content blocks for the Slack message
     */
    static buildBlocks(baseURL, monitorJSON, heartbeatJSON, title, msg) {

        //create an array to dynamically add blocks
        const blocks = [];

        // the header block
        blocks.push({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": title,
            },
        });

        // the body block, containing the details
        blocks.push({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": "*Message*\n" + msg,
                },
                {
                    "type": "mrkdwn",
                    "text": `*Time (${heartbeatJSON["timezone"]})*\n${heartbeatJSON["localDateTime"]}`,
                }
            ],
        });

        const actions = this.buildActions(baseURL, monitorJSON);
        if (actions.length > 0) {
            //the actions block, containing buttons
            blocks.push({
                "type": "actions",
                "elements": actions,
            });
        }

        return blocks;
    }

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        if (notification.slackchannelnotify) {
            msg += " <!channel>";
        }

        try {
            if (heartbeatJSON == null) {
                let data = {
                    "text": msg,
                    "channel": notification.slackchannel,
                    "username": notification.slackusername,
                    "icon_emoji": notification.slackiconemo,
                };
                await axios.post(notification.slackwebhookURL, data);
                return okMsg;
            }

            const baseURL = await Settings.get("primaryBaseURL");

            const title = "Uptime Kuma Alert";
            let data = {
                "text": `${title}\n${msg}`,
                "channel": notification.slackchannel,
                "username": notification.slackusername,
                "icon_emoji": notification.slackiconemo,
                "attachments": [
                    {
                        "color": (heartbeatJSON["status"] === UP) ? "#2eb886" : "#e01e5a",
                        "blocks": Slack.buildBlocks(baseURL, monitorJSON, heartbeatJSON, title, msg),
                    }
                ]
            };

            if (notification.slackbutton) {
                await Slack.deprecateURL(notification.slackbutton);
            }

            await axios.post(notification.slackwebhookURL, data);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = Slack;

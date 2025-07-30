import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import * as fs from 'fs/promises';
import * as path from 'path';
import Bot from "../../Bot";

const activeMessagesFilePath = path.join(process.cwd(), 'active-reaction-messages.json');

interface OldActiveMessages {
    [messageId: string]: string | string[];
}

interface ActiveMessage {
    channelId: string;
    categories: string[];
}

interface NewActiveMessages {
    [messageId: string]: ActiveMessage;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
    try {
        await fs.access(filePath);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T;
    } catch (error) {
        return {} as T;
    }
}

export default class MigrateReactions extends BotInteraction {
    constructor(client: Bot) {
        super(client);
        this.category = 'owner';
    }

    get name() {
        return 'migrate-reactions';
    }

    get description() {
        return '[Owner] One-time migration of active reaction messages to the new data format.';
    }

    get permissions() {
        return 'BOT_OWNER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const oldActiveMessages = await readJsonFile<OldActiveMessages>(activeMessagesFilePath);
        const newActiveMessages: NewActiveMessages = {};

        let foundCount = 0;
        let notFoundCount = 0;
        const totalMessages = Object.keys(oldActiveMessages).length;
        let processedCount = 0;

        await interaction.editReply({ content: `Starting migration for ${totalMessages} messages. This may take a while...` });

        const targetGuild = await this.client.guilds.fetch('429001600523042818');
        if (!targetGuild) {
            return interaction.followUp({ content: 'Could not find the target guild to migrate in.', ephemeral: true });
        }

        for (const messageId in oldActiveMessages) {
            processedCount++;
            this.client.logger.log({ handler: this.name, message: `Processing message ${processedCount}/${totalMessages}: ${messageId}` }, true);
            let foundMessage = null;
            this.client.logger.log({ handler: this.name, message: `  -> Searching in guild: ${targetGuild.name}`}, true);
            for (const channel of targetGuild.channels.cache.values()) {
                if (channel.isTextBased()) {
                    try {
                        foundMessage = await (channel as TextChannel).messages.fetch(messageId);
                        if (foundMessage) {
                            this.client.logger.log({ handler: this.name, message: `  + Found message ${messageId} in channel ${channel.name}` }, true);
                            break;
                        }
                    } catch (e) {
                    }
                }
            }

            if (foundMessage) {
                foundCount++;
                const categories = Array.isArray(oldActiveMessages[messageId])
                    ? oldActiveMessages[messageId] as string[]
                    : [oldActiveMessages[messageId] as string];

                newActiveMessages[messageId] = {
                    channelId: foundMessage.channel.id,
                    categories: categories
                };
            } else {
                notFoundCount++;
                this.client.logger.log({ handler: this.name, message: `Could not find message ${messageId} during migration. It will be skipped.` }, true);
            }
        }

        try {
            await fs.writeFile(activeMessagesFilePath, JSON.stringify(newActiveMessages, null, 2));
            await interaction.followUp({
                content: `Migration complete!\n- Successfully migrated ${foundCount} messages.\n- Failed to find ${notFoundCount} messages (they have been removed).`,
                ephemeral: true
            });
        } catch (error) {
            this.client.logger.error({ handler: this.name, message: 'Failed to write migrated reaction roles file.', error });
            await interaction.followUp({ content: 'An error occurred while writing the new active messages file. Please check the logs.', ephemeral: true });
        }
    }
}

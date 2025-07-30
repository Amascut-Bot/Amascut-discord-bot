import { Message, SlashCommandBuilder, TextChannel, NewsChannel, ThreadChannel, DMChannel, PartialDMChannel } from 'discord.js';
import BotEvent from '../types/BotEvent';
import { readdirSync } from 'fs';
import BotInteraction from '../types/BotInteraction';

export default class MessageCreate extends BotEvent {
    get name() {
        return 'messageCreate';
    }

    get fireOnce() {
        return false;
    }

    get enabled() {
        return true;
    }

    async run(message: Message): Promise<any> {
        if (this.client.util.ignoredChannels.includes(message.channel.id)) return;
        if (message.author.id === this.client.user?.id) return;
        if (message.author.bot) return;
        if (message.webhookId) return;
        if (!message.inGuild()) return;
        if (this.client.util.config.guildMessageDisabled.includes(message.guild.id)) return;

        // Auto-delete pin notification system messages
        if (message.type === 6) { // MessageType.ChannelPinnedMessage
            try {
                if (!message.reference || !message.reference.messageId) return;
                // Fetch the message that was actually pinned
                const pinnedMessage = await message.channel.messages.fetch(message.reference.messageId);

                if (!this.client.user) return;

                // Check if the bot pinned the message and if the content contains the trigger phrase
                if (pinnedMessage.author.id === this.client.user.id && pinnedMessage.content.includes('.pin:delete')) {
                    await message.delete();
                    this.client.logger.log({ message: `Auto-deleted pin notification for bot-pinned message in channel ${message.channel.id}` }, true);
                }
            } catch (error) {
                this.client.logger.error({
                    message: `Failed to process pin notification system message in channel ${message.channel.id}`,
                    error: error as Error
                });
            }
            return;
        }

        // Handle guild-specific auto-triggers
        if (await this.client.autoTrigger.handleAutoTriggers(message)) {
            return;
        }

        // Handle URL reactions
        if (await this.client.urlReactionHandler.handleURLReactions(message)) {
            return;
        }

        // slash command handler
        const isOwner = this.client.util.config.owners.includes(message.author.id);
        const buildMention = `<@${this.client.user?.id}> build`;
        const buildNickMention = `<@!${this.client.user?.id}> build`;
        const isBuildCommand = message.content.startsWith(buildMention) || message.content.startsWith(buildNickMention);

        if (isOwner && isBuildCommand) {
            this.client.commandsRun++;

            if (message.content.match(/help/gi)) {
                const buildUsage = [
                    '`build` - Build Server Commands',
                    '`build help` - Shows this message',
                    '`build global` - Build Global Commands',
                    '`build removeall` - Remove Global Commands',
                    '`build guild removeall` - Remove Server Commands',
                ];
                return message.reply({ content: buildUsage.join('\n') });
            }

            if (message.content.match(/removeall/gi)) {
                // remove only the guilds commands
                if (message.content.match(/guild/gi))
                    await message.guild?.commands.set([]).catch((err) => {
                        this.client.logger.error({ error: err.stack, handler: this.constructor.name });
                        message.react('❎');
                    });
                // remove all slash commands globally
                else
                    await this.client.application?.commands.set([]).catch((err) => {
                        this.client.logger.error({ error: err.stack, handler: this.constructor.name });
                        message.react('❎');
                    });
                return message.reply({ content: 'Done' });
            }

            let data: SlashCommandBuilder[] = [];
            await this.buildCommands(data);

            // global commands
            if (message.content.match(/global/gi)) {
                if (!this.client.application) return message.reply({ content: `There is no client.application?` }).catch(() => { });
                let res = await this.client.application.commands.set(data).catch((e) => e);
                if (res instanceof Error) return this.client.logger.error({ error: res.stack, handler: this.constructor.name });
                const header = `Deploying (**${data.length.toLocaleString()}**) global slash commands, This could take up to 1 hour.`;
                const outputLines = data.map((command) => `${command.default_member_permissions === '0' ? '-' : '+'} ${command.name} - '${command.description}'`);
                return this.sendSplitResponse(message.channel, header, outputLines);
            }

            // guild commands
            let res = await message.guild.commands.set(data).catch((e) => e);
            if (res instanceof Error) return this.client.logger.error({ error: res.stack, handler: this.constructor.name });
            const header = `Deploying (**${data.length.toLocaleString()}**) guild slash commands.`;
            const outputLines = data.map((command) => `${command.default_member_permissions === '0' ? '-' : '+'} ${command.name} - '${command.description}'`);
            return this.sendSplitResponse(message.channel, header, outputLines);
        }
    }

    private async sendSplitResponse(channel: any, header: string, lines: string[]) {
        await channel.send({ content: header });
        const messages = [];
        let currentMessage = '';
        for (const line of lines) {
            // 2000 limit - ```diff\n (7) - ``` (3) = 1990
            if (currentMessage.length + line.length + 1 > 1990) {
                messages.push(`\`\`\`diff\n${currentMessage}\`\`\``);
                currentMessage = '';
            }
            currentMessage += line + '\n';
        }
        if (currentMessage) {
            messages.push(`\`\`\`diff\n${currentMessage}\`\`\``);
        }
        for (const msg of messages) {
            await channel.send({ content: msg }).catch((err: Error) => {
                this.client.logger.error({ error: err.stack, handler: this.constructor.name });
            });
        }
    }

    private async buildCommands(data: any[]) {
        const commandPromises = [];
        const directories = readdirSync(`${this.client.location}/src/interactions`, { withFileTypes: true });

        for (const directory of directories) {
            if (!directory.isDirectory()) continue;
            const commandFiles = readdirSync(`${this.client.location}/src/interactions/${directory.name}`, { withFileTypes: true });

            for (const commandFile of commandFiles) {
                if (!commandFile.isFile() || !commandFile.name.endsWith('.ts')) continue;

                commandPromises.push(
                    import(`${this.client.location}/src/interactions/${directory.name}/${commandFile.name}`)
                        .then(interactionModule => {
                            const Command: BotInteraction = new interactionModule.default(this.client);
                            if (Command.slashData) {
                                data.push(Command.slashData);
                            }
                        })
                        .catch(err => {
                            this.client.logger.error({
                                handler: this.constructor.name,
                                message: `Failed to load command: ${commandFile.name}`,
                                error: err.stack
                            });
                        })
                );
            }
        }
        await Promise.all(commandPromises);
    }
}

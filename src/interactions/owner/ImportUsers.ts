import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, Role, SlashCommandBuilder, TextChannel } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const exportedUsersFilePath = path.join(process.cwd(), 'exported-users.json');

export default class ImportUsers extends BotInteraction {
    get name() {
        return 'import-users';
    }

    get description() {
        return 'Imports users from the exported JSON file and grants them the Verified role.';
    }

    get permissions() {
        return [];
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.inCachedGuild()) return;

        // Check if user has admin or owner role from .env
        const hasPermissions = await this.client.util.hasRolePermissions(this.client, ['admin', 'owner'], interaction);
        
        if (!hasPermissions) {
            await interaction.reply({ 
                content: 'You do not have permissions to run this command. This incident has been logged.', 
                ephemeral: true 
            });
            this.client.logger.log({
                message: `Attempted restricted permissions. { command: ${this.name}, user: ${interaction.user.username}, channel: ${interaction.channel} }`,
                handler: this.constructor.name,
            }, true);
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const verifiedRoleId = '1390353573216387072';
        const role = await interaction.guild.roles.fetch(verifiedRoleId);
        
        if (!role) {
            await interaction.editReply({ content: 'Could not find the Verified role. Please check the role ID.' });
            return;
        }

        try {
            const data = await fs.readFile(exportedUsersFilePath, 'utf-8');
            const userIds: string[] = JSON.parse(data);

            let successCount = 0;
            let skippedCount = 0;
            const notFound: string[] = [];

            const logChannelId = '1390351711868158102';
            const logChannel = await this.client.channels.fetch(logChannelId).catch(() => null);

            for (const userId of userIds) {
                try {
                    const member = await interaction.guild.members.fetch(userId);
                    
                    // Skip if user already has the role
                    if (member.roles.cache.has(role.id)) {
                        skippedCount++;
                        continue;
                    }
                    
                    await member.roles.add(role);
                    successCount++;
                    if (logChannel && logChannel.isTextBased()) {
                        (logChannel as TextChannel).send(`Granted role **${role.name}** to ${member.user.tag}.`).catch(console.error);
                    }
                } catch (error) {
                    notFound.push(userId);
                }
            }
            
            const logMessage = {
                message: `Import process completed. Granted '${role.name}' to ${successCount} users. ${skippedCount} users already had the role. ${notFound.length} users not found.`,
                user: interaction.user.username,
                handler: this.constructor.name,
            };
            this.client.logger.log(logMessage, true);

            let replyMessage = `Successfully granted the **${role.name}** role to ${successCount} users.`;
            if (skippedCount > 0) {
                replyMessage += `\nSkipped ${skippedCount} users who already had the role.`;
            }
            if (notFound.length > 0) {
                replyMessage += `\nCould not find ${notFound.length} users.`;
            }
            if (!logChannel || !logChannel.isTextBased()) {
                replyMessage += `\n**Warning:** Could not find the logging channel. Role grants were not logged individually.`
            }

            await interaction.editReply({ content: replyMessage });

        } catch (err: any) {
            if (err.code === 'ENOENT') {
                await interaction.editReply({ content: '`exported-users.json` not found. Please run the `export-users` command first.' });
            } else {
                console.error(err);
                const logMessage = {
                    message: `Failed to import users for Verified role.`,
                    error: err,
                    handler: this.constructor.name,
                };
                this.client.logger.error(logMessage);
                await interaction.editReply({
                    content: 'An error occurred while importing users. This has been logged.',
                });
            }
        }
    }
} 
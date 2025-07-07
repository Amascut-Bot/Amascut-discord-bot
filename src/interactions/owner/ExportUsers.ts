import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, Role, SlashCommandBuilder, TextChannel } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const exportedUsersFilePath = path.join(process.cwd(), 'exported-users.json');

export default class ExportUsers extends BotInteraction {
    get name() {
        return 'export-users';
    }

    get description() {
        return 'Exports all users with specific roles to a JSON file.';
    }

    get permissions() {
        return 'OWNER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addRoleOption((option) => option.setName('role1').setDescription('A role to export users from.').setRequired(true))
            .addRoleOption((option) => option.setName('role2').setDescription('An optional second role to export users from.').setRequired(false))
            .addRoleOption((option) => option.setName('role3').setDescription('An optional third role to export users from.').setRequired(false))
            .addRoleOption((option) => option.setName('role4').setDescription('An optional fourth role to export users from.').setRequired(false))
            .addRoleOption((option) => option.setName('role5').setDescription('An optional fifth role to export users from.').setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.inCachedGuild()) return;

        await interaction.deferReply({ ephemeral: true });

        const roles: Role[] = [];
        for (let i = 1; i <= 5; i++) {
            const role = interaction.options.getRole(`role${i}`) as Role | null;
            if (role) {
                roles.push(role);
            }
        }

        const roleIds = roles.map(r => r.id);
        const roleNames = roles.map(r => r.name).join(', ');

        try {
            const logChannelId = '1390351711868158102';
            const logChannel = await this.client.channels.fetch(logChannelId).catch(() => null);

            await interaction.guild.members.fetch();
            const membersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.some(r => roleIds.includes(r.id)));
            const newUsers = membersWithRole.map(member => member.id);

            let existingUsers: string[] = [];
            try {
                const data = await fs.readFile(exportedUsersFilePath, 'utf-8');
                const parsedData = JSON.parse(data);
                if (Array.isArray(parsedData)) {
                    existingUsers = parsedData;
                }
            } catch (readError: any) {
                if (readError.code !== 'ENOENT') {
                    throw readError;
                }
            }

            const allUsersSet = new Set([...existingUsers, ...newUsers]);
            const allUsers = Array.from(allUsersSet);

            await fs.writeFile(exportedUsersFilePath, JSON.stringify(allUsers, null, 2));

            const newUsersAddedCount = allUsers.length - existingUsers.length;

            const logMessage = {
                message: `Exported ${newUsers.length} users with the roles '${roleNames}'. Added ${newUsersAddedCount} new users.`,
                user: interaction.user.username,
                handler: this.constructor.name,
            };
            this.client.logger.log(logMessage, true);

            if (logChannel && logChannel.isTextBased()) {
                const logHeader = `User **${interaction.user.tag}** exported ${membersWithRole.size} users with the roles **${roleNames}**. Added ${newUsersAddedCount} new users. Total in file: ${allUsers.length}.`;
                await (logChannel as TextChannel).send(logHeader).catch(console.error);

                if (membersWithRole.size > 0) {
                    let userListMessage = '';
                    const userList = membersWithRole.map(m => `- ${m.user.tag} (\`${m.id}\`)`);

                    for (const user of userList) {
                        if (userListMessage.length + user.length + 1 > 2000) {
                            await (logChannel as TextChannel).send(userListMessage).catch(console.error);
                            userListMessage = '';
                        }
                        userListMessage += user + '\n';
                    }

                    if (userListMessage) {
                        await (logChannel as TextChannel).send(userListMessage).catch(console.error);
                    }
                } else {
                    await (logChannel as TextChannel).send("No new users with these roles found to add.").catch(console.error);
                }
            }

            let replyMessage = `Successfully exported ${newUsers.length} users with the roles **${roleNames}**. ${newUsersAddedCount} new users were added, bringing the total to ${allUsers.length}.`;
            if (!logChannel || !logChannel.isTextBased()) {
                replyMessage += `\n**Warning:** Could not find the logging channel. The export was not logged.`
            }

            await interaction.editReply({
                content: replyMessage,
            });
        } catch (err: any) {
            console.error(err);
            const logMessage = {
                message: `Failed to export users with the roles '${roleNames}'.`,
                error: err,
                handler: this.constructor.name,
            };
            this.client.logger.error(logMessage);
            await interaction.editReply({
                content: 'An error occurred while exporting users. This has been logged.',
            });
        }
    }
} 
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, User, Role, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, MessageFlags } from 'discord.js';

export default class AssignMatchmaking extends BotInteraction {
    get name() {
        return 'assign-matchmaking';
    }

    get description() {
        return 'Assigns matchmaking roles to a user';
    }

    get permissions() {
        return 'TRIAL_TEAM';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
            .addStringOption((option) => option.setName('role').setDescription('Role').setAutocomplete(true).setRequired(true))
    }

    async autocomplete(interaction: any) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name !== 'role') return;

        const options = {
            'Elite 1000': 'elite1000',
            'Elite 2000': 'elite2000',
            'Master 1000': 'master1000',
            'Master 2000': 'master2000',
            'Grandmaster 2000': 'grandmaster2000'
        };

        const filtered = Object.keys(options)
            .filter(key => key.toLowerCase().startsWith(focusedOption.value.toLowerCase()))
            .map(key => ({ name: key, value: options[key as keyof typeof options] }));

        await interaction.respond(filtered);
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetUser: User = interaction.options.getUser('user', true);
        const roleKey: string = interaction.options.getString('role', true);
        const { colours } = this.client.util;
        const rolePriority = this.client.util.getTrialTierPriority(roleKey);
        const trialedRoleId = this.client.roleIds[roleKey];

        if (rolePriority === null || !trialedRoleId) {
            return await interaction.editReply({ content: 'Invalid role selection.' });
        }

        const member = await interaction.guild?.members.fetch(targetUser.id);
        const userRoleIds = member?.roles.cache.map(r => r.id) || [];

        const trialedRoleObject = await interaction.guild?.roles.fetch(trialedRoleId) as Role;

        if (!trialedRoleObject) {
            return await interaction.editReply({ content: 'Role not found.' });
        }

        const hasHigherRole = this.client.util.hasTrialRoleAbovePriority(userRoleIds, rolePriority);
        const hasThisRole = userRoleIds.includes(trialedRoleId);

        if (hasHigherRole || hasThisRole) {
            const embed = new EmbedBuilder()
                .setTitle('Role assign failed')
                .setColor(colours.discord.red)
                .setDescription(`<@${targetUser.id}> already has this role or a higher-priority role.`);

            return await interaction.editReply({ embeds: [embed] });
        }

        const roleTransition = this.client.util.getTrialRoleTransition(userRoleIds, roleKey);
        const rolesToAdd = roleTransition.addedRoleIds;
        const rolesToRemove = roleTransition.removedRoleIds;
        const grantedRoleMentions = roleTransition.addedRoleMentions;
        const removedRoleMentions = roleTransition.removedRoleMentions;

        if (rolesToRemove.length > 0) {
            await member?.roles.remove(rolesToRemove);
        }

        if (rolesToAdd.length > 0) {
            await member?.roles.add(rolesToAdd);
        }

        const confirmationChannel = this.client.channelIds.achievements
            ? await this.client.channels.fetch(this.client.channelIds.achievements) as TextChannel
            : null;

        let confirmationMessage: Message | null = null;
        let messageUrl = '';
        if (confirmationChannel) {
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: interaction.user.username,
                    iconURL: interaction.user.avatarURL() || undefined
                })
                .setTimestamp()
                .setColor(trialedRoleObject.hexColor)
                .setDescription(`Congratulations to <@${targetUser.id}> on achieving ${this.client.roles[roleKey]}!`);

            const message = await confirmationChannel.send({ embeds: [embed] });
            confirmationMessage = message;
            messageUrl = message.url;
        }

        const logChannelId = this.client.channelIds.roleAssignLogs;
        const logChannel = logChannelId ? await this.client.channels.fetch(logChannelId) as TextChannel : null;
        if (logChannel) {
            const changeLines: string[] = [];

            if (grantedRoleMentions.length > 0) {
                changeLines.push(`${grantedRoleMentions.join(', ')} were assigned to <@${targetUser.id}> by <@${interaction.user.id}>.`);
            }

            if (removedRoleMentions.length > 0) {
                changeLines.push(`${removedRoleMentions.join(', ')} were removed from <@${targetUser.id}>.`);
            }

            if (messageUrl) {
                changeLines.push(`**Message**: ${messageUrl}`);
            }

            const roleAssignmentLog = await this.client.util.createRoleAssignmentLog({
                targetUserId: targetUser.id,
                actorUserId: interaction.user.id,
                source: 'assign-matchmaking',
                addedRoleIds: rolesToAdd,
                removedRoleIds: rolesToRemove,
                announcementChannelId: confirmationMessage?.channelId ?? null,
                announcementMessageId: confirmationMessage?.id ?? null
            });

            const logEmbed = new EmbedBuilder()
                .setTimestamp()
                .setColor(trialedRoleObject.hexColor)
                .setDescription(changeLines.join('\n'));

            const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(this.client.util.getRejectRoleAssignCustomId(roleAssignmentLog.id))
                        .setLabel('Reject Approval')
                        .setStyle(ButtonStyle.Danger)
                );

            await logChannel.send({ embeds: [logEmbed], components: [buttonRow] });
        }

        const replyEmbed = new EmbedBuilder()
            .setTitle('Role successfully assigned')
            .setColor(colours.discord.green)
            .setDescription(`**Member:** <@${targetUser.id}>\n**Trialed Role:** ${this.client.roles[roleKey]}\n**Assigned Roles:** ${grantedRoleMentions.length > 0 ? grantedRoleMentions.join(', ') : 'None'}${removedRoleMentions.length > 0 ? `\n**Removed Roles:** ${removedRoleMentions.join(', ')}` : ''}`);

        await interaction.editReply({ embeds: [replyEmbed] });
    }
}

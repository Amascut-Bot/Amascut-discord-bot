import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, User, Role, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

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

    get coverTag() {
        return 'elite';
    }

    get hierarchy() {
        return ['elite500', 'elite750', 'elite1000', 'elite2000'];
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
            'Elite 500': 'elite500',
            'Elite 750': 'elite750',
            'Elite 1000': 'elite1000',
            'Elite 2000': 'elite2000'
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

        const member = await interaction.guild?.members.fetch(targetUser.id);
        const userRoleIds = member?.roles.cache.map(r => r.id) || [];

        const trialedRoleId = this.client.roleIds[roleKey];
        const coverTagId = this.client.roleIds[this.coverTag];
        const trialedRoleObject = await interaction.guild?.roles.fetch(trialedRoleId) as Role;
        
        if (!trialedRoleObject) {
            return await interaction.editReply({ content: 'Role not found.' });
        }

        const roleIndex = this.hierarchy.indexOf(roleKey);
        const higherRoles = this.hierarchy.slice(roleIndex + 1);
        const lowerRoles = this.hierarchy.slice(0, roleIndex);

        const hasHigherRole = higherRoles.some(r => userRoleIds.includes(this.client.roleIds[r]));
        const hasThisRole = userRoleIds.includes(trialedRoleId);

        if (hasHigherRole || hasThisRole) {
            const embed = new EmbedBuilder()
                .setTitle('Role assign failed')
                .setColor(colours.discord.red)
                .setDescription(`<@${targetUser.id}> already has this role or a higher role.`);
            
            return await interaction.editReply({ embeds: [embed] });
        }

        const rolesToAdd = [trialedRoleId, coverTagId];
        
        for (const lowerRole of lowerRoles) {
            rolesToAdd.push(this.client.roleIds[lowerRole]);
        }

        await member?.roles.add(rolesToAdd);

        const confirmationChannel = this.client.channelIds.roleConfirmations 
            ? await this.client.channels.fetch(this.client.channelIds.roleConfirmations) as TextChannel
            : null;

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
            messageUrl = message.url;
        }

        const logChannelId = this.client.channelIds.botRoleLog;
        const logChannel = logChannelId ? await this.client.channels.fetch(logChannelId) as TextChannel : null;
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTimestamp()
                .setColor(trialedRoleObject.hexColor)
                .setDescription(`${this.client.roles[roleKey]} and ${this.client.roles[this.coverTag]} were assigned to <@${targetUser.id}> by <@${interaction.user.id}>.\n${messageUrl ? `**Message**: ${messageUrl}` : ''}`);

            const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('rejectRoleAssign')
                        .setLabel('Reject Approval')
                        .setStyle(ButtonStyle.Danger)
                );

            await logChannel.send({ embeds: [logEmbed], components: [buttonRow] });
        }

        const replyEmbed = new EmbedBuilder()
            .setTitle('Role successfully assigned')
            .setColor(colours.discord.green)
            .setDescription(`**Member:** <@${targetUser.id}>\n**Trialed Role:** ${this.client.roles[roleKey]}\n**Cover Tag:** ${this.client.roles[this.coverTag]}`);

        await interaction.editReply({ embeds: [replyEmbed] });
    }
}
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ContainerBuilder,
    GuildMember,
    Interaction,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
    SeparatorSpacingSize,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
} from 'discord.js';
import { Repository } from 'typeorm';
import Bot from '../Bot';
import { ScheduledTrial } from '../entity/ScheduledTrial';
import HostHandler from './HostHandler';

// A trial team caps at 5 players total (host + trialees + fills). The fill cap is derived from the
// configured minimum trialees: 5 total - host - minTrialees, floored at 0.
const MAX_PARTICIPANTS = 5; // includes the host

export default class ScheduledTrialHandler {
    client: Bot;
    id: string;
    interaction: Interaction;

    constructor(client: Bot, id: string, interaction: Interaction) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;

        this.route();
    }

    private get repo(): Repository<ScheduledTrial> {
        return this.client.dataSource.getRepository(ScheduledTrial);
    }

    private async route(): Promise<void> {
        const id = this.id;
        try {
            if (id.startsWith('schedtrial_createmodal_')) return await this.handleCreateModal(id.substring('schedtrial_createmodal_'.length));
            if (id.startsWith('schedtrial_fillsignup_')) return await this.handleFillSignup(id.substring('schedtrial_fillsignup_'.length));
            if (id.startsWith('schedtrial_signup_')) return await this.handleSignup(id.substring('schedtrial_signup_'.length));
            if (id.startsWith('schedtrial_base_')) return await this.handleBaseSignup(id.substring('schedtrial_base_'.length));
            if (id.startsWith('schedtrial_cancel_')) return await this.handleCancel(id.substring('schedtrial_cancel_'.length));
            if (id.startsWith('schedtrial_removeselect_')) return await this.handleRemoveSelect(id.substring('schedtrial_removeselect_'.length));
            if (id.startsWith('schedtrial_remove_')) return await this.handleRemovePrompt(id.substring('schedtrial_remove_'.length));
            if (id.startsWith('schedtrial_finishmodal_')) return await this.handleFinishSubmit(id.substring('schedtrial_finishmodal_'.length));
            if (id.startsWith('schedtrial_finish_')) return await this.handleFinishPrompt(id.substring('schedtrial_finish_'.length));
        } catch (err) {
            this.client.logger.error({ message: 'ScheduledTrialHandler error', error: err, handler: this.constructor.name });
        }
    }

    // ===============================
    // Card rendering
    // ===============================

    public static buildCard(client: Bot, trial: ScheduledTrial): ContainerBuilder {
        const tierLabel = HostHandler.trialRoleKeyToLabel(trial.tier);
        const roleMention = client.roles[trial.tier] ?? tierLabel;
        const fills = trial.fills ?? [];
        const isTicket = trial.kind === 'ticket';

        const fillList = fills.length > 0
            ? fills.map(userId => `<@${userId}>`).join('\n')
            : '_None yet_';

        const container = client.cv2.getContainerBuilder(null, `## ${isTicket ? 'Trial' : 'Scheduled Trial'} — ${tierLabel}`);

        if (isTicket) {
            const trialeeMention = trial.trialees[0] ? `<@${trial.trialees[0]}>` : '_unknown_';
            container.addTextDisplayComponents(t => t.setContent(
                `**Host:** <@${trial.hostId}>\n` +
                `**Trialee:** ${trialeeMention}\n` +
                `**Role:** ${roleMention}`
            ));
        } else {
            const unix = Math.floor(trial.scheduledTime.getTime() / 1000);
            container.addTextDisplayComponents(t => t.setContent(
                `**Host:** <@${trial.hostId}>\n` +
                `**Role:** ${roleMention}\n` +
                `**Time:** <t:${unix}:F> (<t:${unix}:R>)`
            ));
        }

        if (trial.message) {
            container.addTextDisplayComponents(t => t.setContent(`**Message:** ${trial.message}`));
        }

        container.addSeparatorComponents(s => s.setSpacing(SeparatorSpacingSize.Small));

        if (!isTicket) {
            const trialeeList = trial.trialees.length > 0
                ? trial.trialees.map(userId => `<@${userId}>`).join('\n')
                : '_None yet_';
            container.addTextDisplayComponents(t => t.setContent(`**Trialees (${trial.trialees.length}/${trial.maxTrialees}, min ${trial.minTrialees}):**\n${trialeeList}`));
        }
        container.addTextDisplayComponents(t => t.setContent(`**Trial Team Fills (${fills.length}/${ScheduledTrialHandler.maxFills(trial)}):**\n${fillList}`));
        if (!isTicket) {
            container.addTextDisplayComponents(t => t.setContent(`**Base:** ${trial.baseId ? `<@${trial.baseId}>` : '_None yet_'}`));
        }
        container.addTextDisplayComponents(t => t.setContent(`_Total players: ${ScheduledTrialHandler.totalPlayers(trial)}/${MAX_PARTICIPANTS} (incl. host)_`));

        const buttons: ButtonBuilder[] = [];
        if (!isTicket) {
            buttons.push(new ButtonBuilder().setCustomId(`schedtrial_signup_${trial.id}`).setLabel('Trialee sign up / withdraw').setStyle(ButtonStyle.Primary));
        }
        buttons.push(
            new ButtonBuilder().setCustomId(`schedtrial_fillsignup_${trial.id}`).setLabel('Fill sign up / withdraw').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`schedtrial_finish_${trial.id}`).setLabel('Finish').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`schedtrial_remove_${trial.id}`).setLabel('Remove').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`schedtrial_cancel_${trial.id}`).setLabel(isTicket ? 'Disband' : 'Cancel').setStyle(ButtonStyle.Danger),
        );
        container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));

        // The base control lives on its OWN action row — the row above already holds the max 5 buttons,
        // so pushing onto it would throw "Invalid Form Body" at runtime.
        if (!isTicket) {
            const baseButton = new ButtonBuilder()
                .setCustomId(`schedtrial_base_${trial.id}`)
                .setLabel(trial.baseId ? 'Base sign up / step down' : 'Base sign up')
                .setStyle(ButtonStyle.Secondary);
            container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(baseButton));
        }

        return container;
    }

    private async renderCard(trial: ScheduledTrial): Promise<void> {
        if (!trial.messageId) return;
        try {
            const channel = await this.client.channels.fetch(trial.channelId) as TextChannel;
            const message = await channel.messages.fetch(trial.messageId);
            await message.edit({
                components: [ScheduledTrialHandler.buildCard(this.client, trial)],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            });
        } catch (err) {
            // card may have been deleted manually — ignore
        }
    }

    private async deleteCard(trial: ScheduledTrial): Promise<void> {
        if (!trial.messageId) return;
        try {
            const channel = await this.client.channels.fetch(trial.channelId) as TextChannel;
            const message = await channel.messages.fetch(trial.messageId);
            await message.delete();
        } catch (err) {
            // already gone — ignore
        }
    }

    // ===============================
    // Helpers
    // ===============================

    private async getTrial(idStr: string): Promise<ScheduledTrial | null> {
        const id = Number.parseInt(idStr, 10);
        if (Number.isNaN(id)) return null;
        const trial = await this.repo.findOne({ where: { id } });
        if (trial && !trial.fills) trial.fills = []; // backfill rows created before fills existed
        return trial;
    }

    private static totalPlayers(trial: ScheduledTrial): number {
        return 1 + trial.trialees.length + (trial.fills?.length ?? 0); // host + trialees + fills
    }

    private static maxFills(trial: ScheduledTrial): number {
        return Math.max(0, MAX_PARTICIPANTS - 1 - trial.minTrialees); // 5 total - host - min trialees
    }

    private async canManage(trial: ScheduledTrial): Promise<boolean> {
        if (this.interaction.user.id === trial.hostId) return true;
        return (await this.client.util.hasRolePermissions(this.client, ['trialTeam', 'admin', 'owner'], this.interaction)) === true;
    }

    /**
     * Parses an in-game (UTC) "YYYY-MM-DD HH:MM" string into a Date, or null if invalid.
     */
    private parseInGameTime(input: string): Date | null {
        const match = input.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/);
        if (!match) return null;

        const [, year, month, day, hour, minute] = match.map(Number);
        const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

        if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day ||
            date.getUTCHours() !== hour ||
            date.getUTCMinutes() !== minute
        ) {
            return null;
        }

        return date;
    }

    // ===============================
    // Modal: create scheduled trial (from /schedule-trial)
    // ===============================

    private async handleCreateModal(rest: string): Promise<void> {
        const interaction = this.interaction as ModalSubmitInteraction;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.guild) {
            await interaction.editReply('This command can only be used in a server.');
            return;
        }

        // rest === `${tier}_${minTrialees}_${maxTrialees}` — tier keys contain no underscores
        const parts = rest.split('_');
        const tier = parts[0];
        const minTrialees = Number.parseInt(parts[1] ?? '1', 10);
        const maxTrialees = Number.parseInt(parts[2] ?? '1', 10);

        if (!tier || Number.isNaN(minTrialees) || Number.isNaN(maxTrialees) || minTrialees < 1 || maxTrialees < 1) {
            await interaction.editReply('Could not read the trial details. Please run the command again.');
            return;
        }

        if (minTrialees > maxTrialees) {
            await interaction.editReply('The minimum number of trialees cannot be greater than the maximum.');
            return;
        }

        const inGameTimeInput = interaction.fields.getTextInputValue('in_game_time');
        const message = interaction.fields.getTextInputValue('message');

        const scheduledTime = this.parseInGameTime(inGameTimeInput);
        if (!scheduledTime) {
            await interaction.editReply('Could not read that time. Use the in-game (UTC) format `YYYY-MM-DD HH:MM`, e.g. `2026-06-01 18:30`.');
            return;
        }

        if (scheduledTime.getTime() <= Date.now()) {
            await interaction.editReply('That time is in the past. Please pick a future in-game (UTC) time.');
            return;
        }

        const channelId = this.client.channelIds.trialScheduling;
        if (!channelId) {
            await interaction.editReply('No trial scheduling channel is configured for this server.');
            return;
        }

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null) as TextChannel | null;
        if (!channel) {
            await interaction.editReply('Could not find the trial scheduling channel.');
            return;
        }

        const scheduledTrial = new ScheduledTrial();
        scheduledTrial.guildId = interaction.guild.id;
        scheduledTrial.channelId = channel.id;
        scheduledTrial.messageId = null;
        scheduledTrial.hostId = interaction.user.id;
        scheduledTrial.tier = tier;
        scheduledTrial.scheduledTime = scheduledTime;
        scheduledTrial.minTrialees = minTrialees;
        scheduledTrial.maxTrialees = maxTrialees;
        scheduledTrial.trialees = [];
        scheduledTrial.fills = [];
        scheduledTrial.baseId = null;
        scheduledTrial.message = message && message.length > 0 ? message : null;
        scheduledTrial.reminderSent = false;
        scheduledTrial.status = 'scheduled';

        const saved = await this.repo.save(scheduledTrial);

        const cardMessage = await channel.send({
            components: [ScheduledTrialHandler.buildCard(this.client, saved)],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        });

        saved.messageId = cardMessage.id;
        await this.repo.save(saved);

        // Ping the global trial-team role + the tier's trialee role so sign-ups are driven. Posted in
        // trialee-chat on MAIN; falls back to the scheduling channel where trialeeChat is unconfigured.
        try {
            const teamRoleId = this.client.roleIds.trialTeam;
            const trialeeRoleKey = this.client.util.getTrialeeRoleKey(tier);
            const trialeeRoleId = trialeeRoleKey ? this.client.roleIds[trialeeRoleKey] : undefined;
            const pingRoleIds = [teamRoleId, trialeeRoleId].filter((roleId): roleId is string => !!roleId && roleId !== '000000000000000000');

            if (pingRoleIds.length > 0) {
                const pingChannelId = this.client.channelIds.trialeeChat || channel.id;
                let pingChannel = await interaction.guild.channels.fetch(pingChannelId).catch(() => null) as TextChannel | null;
                if (!pingChannel && pingChannelId !== channel.id) {
                    pingChannel = channel;
                }
                if (pingChannel) {
                    const tierLabel = HostHandler.trialRoleKeyToLabel(tier);
                    const unix = Math.floor(scheduledTime.getTime() / 1000);
                    const mentions = pingRoleIds.map(roleId => `<@&${roleId}>`).join(' ');
                    await pingChannel.send({
                        content: `${mentions}\nA **${tierLabel}** trial has been scheduled for <t:${unix}:F> (<t:${unix}:R>). Head over to <#${channel.id}> to sign up!`,
                        allowedMentions: { roles: pingRoleIds }
                    });
                }
            }
        } catch (err) {
            this.client.logger.error({ message: 'Scheduled trial ping failed', error: err, handler: this.constructor.name });
        }

        await interaction.editReply(`Trial scheduled! Head over to <#${channel.id}> to find the sign-up card.`);
    }

    // ===============================
    // Button: sign up / withdraw
    // ===============================

    private async handleSignup(idStr: string): Promise<void> {
        const interaction = this.interaction as ButtonInteraction<'cached'>;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const trial = await this.getTrial(idStr);
        if (!trial || trial.status !== 'scheduled') {
            await interaction.editReply('This scheduled trial is no longer available.');
            return;
        }

        const member = interaction.member as GuildMember;
        trial.fills = trial.fills ?? [];

        if (trial.trialees.includes(member.id)) {
            trial.trialees = trial.trialees.filter(userId => userId !== member.id);
            if (trial.baseId === member.id) trial.baseId = null; // leaving participant can no longer be base
            await this.repo.save(trial);
            await this.renderCard(trial);
            await interaction.editReply('You have withdrawn from this trial.');
            return;
        }

        if (trial.fills.includes(member.id)) {
            await interaction.editReply('You are already signed up as a fill. Withdraw from fills first if you want to trial.');
            return;
        }

        const trialeeRoleKey = this.client.util.getTrialeeRoleKey(trial.tier);
        const trialeeRoleId = trialeeRoleKey ? this.client.roleIds[trialeeRoleKey] : null;
        if (!trialeeRoleId || !member.roles.cache.has(trialeeRoleId)) {
            const required = trialeeRoleKey ? (this.client.roles[trialeeRoleKey] ?? 'the required trialee role') : 'the required trialee role';
            await interaction.editReply(`You need ${required} to sign up for this trial.`);
            return;
        }

        if (trial.trialees.length >= trial.maxTrialees) {
            await interaction.editReply('All trialee slots are already filled.');
            return;
        }

        if (ScheduledTrialHandler.totalPlayers(trial) >= MAX_PARTICIPANTS) {
            await interaction.editReply(`This trial is already full (${MAX_PARTICIPANTS} players including the host).`);
            return;
        }

        trial.trialees.push(member.id);
        await this.repo.save(trial);
        await this.renderCard(trial);
        await interaction.editReply('You have signed up as a trialee!');
    }

    // ===============================
    // Button: trial-team fill sign up / withdraw
    // ===============================

    private async handleFillSignup(idStr: string): Promise<void> {
        const interaction = this.interaction as ButtonInteraction<'cached'>;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const trial = await this.getTrial(idStr);
        if (!trial || trial.status !== 'scheduled') {
            await interaction.editReply('This scheduled trial is no longer available.');
            return;
        }

        const member = interaction.member as GuildMember;
        trial.fills = trial.fills ?? [];

        if (trial.fills.includes(member.id)) {
            trial.fills = trial.fills.filter(userId => userId !== member.id);
            if (trial.baseId === member.id) trial.baseId = null; // leaving participant can no longer be base
            await this.repo.save(trial);
            await this.renderCard(trial);
            await interaction.editReply('You have withdrawn from the fills.');
            return;
        }

        if (member.id === trial.hostId) {
            await interaction.editReply('You are the host of this trial and cannot also take a fill slot.');
            return;
        }

        if (trial.trialees.includes(member.id)) {
            await interaction.editReply('You are already signed up as a trialee. Withdraw from trialees first if you want to fill.');
            return;
        }

        if (!(await this.client.util.hasRolePermissions(this.client, ['trialTeam', 'admin', 'owner'], interaction))) {
            await interaction.editReply('Only trial team members can sign up as a fill.');
            return;
        }

        const maxFills = ScheduledTrialHandler.maxFills(trial);
        if (trial.fills.length >= maxFills) {
            await interaction.editReply(`All fill slots are already taken (max ${maxFills}).`);
            return;
        }

        if (ScheduledTrialHandler.totalPlayers(trial) >= MAX_PARTICIPANTS) {
            await interaction.editReply(`This trial is already full (${MAX_PARTICIPANTS} players including the host).`);
            return;
        }

        trial.fills.push(member.id);
        await this.repo.save(trial);
        await this.renderCard(trial);
        await interaction.editReply('You have signed up as a fill!');
    }

    // ===============================
    // Button: base sign up / step down
    // ===============================

    private async handleBaseSignup(idStr: string): Promise<void> {
        const interaction = this.interaction as ButtonInteraction<'cached'>;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const trial = await this.getTrial(idStr);
        if (!trial || trial.status !== 'scheduled' || trial.kind === 'ticket') {
            await interaction.editReply('This scheduled trial is no longer available.');
            return;
        }

        const member = interaction.member as GuildMember;
        trial.fills = trial.fills ?? [];

        // Caller already holds base -> toggle off (release).
        if (trial.baseId === member.id) {
            trial.baseId = null;
            await this.repo.save(trial);
            await this.renderCard(trial);
            await interaction.editReply('You are no longer the base for this trial.');
            return;
        }

        // Base already held by a different participant -> reject (no takeover).
        if (trial.baseId) {
            await interaction.editReply(`A base is already assigned to <@${trial.baseId}>.`);
            return;
        }

        // Must be the host or an already-signed-up participant (trialee or fill) to claim base.
        if (member.id !== trial.hostId && !trial.trialees.includes(member.id) && !trial.fills.includes(member.id)) {
            await interaction.editReply('You must be the host or signed up as a trialee or fill before you can sign up as the base.');
            return;
        }

        trial.baseId = member.id;
        await this.repo.save(trial);
        await this.renderCard(trial);
        await interaction.editReply('You are now the base for this trial.');
    }

    // ===============================
    // Button: cancel
    // ===============================

    private async handleCancel(idStr: string): Promise<void> {
        const interaction = this.interaction as ButtonInteraction<'cached'>;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const trial = await this.getTrial(idStr);
        if (!trial || trial.status !== 'scheduled') {
            await interaction.editReply('This scheduled trial is no longer available.');
            return;
        }

        if (!await this.canManage(trial)) {
            await interaction.editReply('Only the host or a trial team member can cancel this trial.');
            return;
        }

        trial.status = 'cancelled';
        await this.repo.save(trial);

        // Only notify for scheduled trials (public channel). Ticket trials live in the private
        // trial-team thread, where pinging the trialee would add them to that thread.
        const involved = [...trial.trialees, ...(trial.fills ?? [])];
        if (trial.kind !== 'ticket' && involved.length > 0) {
            try {
                const channel = await this.client.channels.fetch(trial.channelId) as TextChannel;
                await channel.send({
                    content: `The scheduled ${HostHandler.trialRoleKeyToLabel(trial.tier)} trial hosted by <@${trial.hostId}> has been cancelled.\n${involved.map(userId => `<@${userId}>`).join(' ')}`,
                    allowedMentions: { users: [...new Set([trial.hostId, ...involved])] }
                });
            } catch (err) {
                // ignore notification failure
            }
        }

        await this.deleteCard(trial);
        await interaction.editReply(trial.kind === 'ticket' ? 'Trial disbanded.' : 'Scheduled trial cancelled.');
    }

    // ===============================
    // Button: remove trialee (prompt) + select
    // ===============================

    private async handleRemovePrompt(idStr: string): Promise<void> {
        const interaction = this.interaction as ButtonInteraction<'cached'>;

        const trial = await this.getTrial(idStr);
        if (!trial || trial.status !== 'scheduled') {
            await interaction.reply({ content: 'This scheduled trial is no longer available.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (!await this.canManage(trial)) {
            await interaction.reply({ content: 'Only the host or a trial team member can remove participants.', flags: MessageFlags.Ephemeral });
            return;
        }

        const fills = trial.fills ?? [];
        // For ticket trials the trialee is the fixed ticket opener and cannot be removed — fills only.
        const removableTrialees = trial.kind === 'ticket' ? [] : trial.trialees;
        if (removableTrialees.length === 0 && fills.length === 0) {
            await interaction.reply({ content: 'There are no removable participants yet.', flags: MessageFlags.Ephemeral });
            return;
        }

        // Cache-only lookups — must reply within 3s, so avoid awaiting member fetches here.
        const trialeeOptions = removableTrialees.map(userId => {
            const member = interaction.guild.members.cache.get(userId);
            return new StringSelectMenuOptionBuilder().setLabel(`Trialee: ${member?.displayName ?? userId}`).setValue(userId);
        });
        const fillOptions = fills.map(userId => {
            const member = interaction.guild.members.cache.get(userId);
            return new StringSelectMenuOptionBuilder().setLabel(`Fill: ${member?.displayName ?? userId}`).setValue(userId);
        });

        const select = new StringSelectMenuBuilder()
            .setCustomId(`schedtrial_removeselect_${trial.id}`)
            .setPlaceholder('Select a participant to remove')
            .addOptions([...trialeeOptions, ...fillOptions])
            .setMinValues(1)
            .setMaxValues(1);

        await interaction.reply({
            content: 'Select a participant to remove from this trial:',
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
            flags: MessageFlags.Ephemeral
        });
    }

    private async handleRemoveSelect(idStr: string): Promise<void> {
        const interaction = this.interaction as StringSelectMenuInteraction<'cached'>;
        await interaction.deferUpdate();

        const trial = await this.getTrial(idStr);
        if (!trial || trial.status !== 'scheduled') {
            await interaction.editReply({ content: 'This scheduled trial is no longer available.', components: [] });
            return;
        }

        if (!await this.canManage(trial)) {
            await interaction.editReply({ content: 'Only the host or a trial team member can remove participants.', components: [] });
            return;
        }

        const removeId = interaction.values[0];
        trial.trialees = trial.trialees.filter(userId => userId !== removeId);
        trial.fills = (trial.fills ?? []).filter(userId => userId !== removeId);
        if (trial.baseId === removeId) trial.baseId = null; // removed participant can no longer be base
        await this.repo.save(trial);
        await this.renderCard(trial);

        await interaction.editReply({ content: `Removed <@${removeId}> from this trial.`, components: [], allowedMentions: { parse: [] } });
    }

    // ===============================
    // Button: finish (prompt modal) + modal submit
    // ===============================

    private async handleFinishPrompt(idStr: string): Promise<void> {
        const interaction = this.interaction as ButtonInteraction<'cached'>;

        const trial = await this.getTrial(idStr);
        if (!trial || trial.status !== 'scheduled') {
            await interaction.reply({ content: 'This scheduled trial is no longer available.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (!await this.canManage(trial)) {
            await interaction.reply({ content: 'Only the host or a trial team member can finish this trial.', flags: MessageFlags.Ephemeral });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`schedtrial_finishmodal_${trial.id}`)
            .setTitle('Finish Trial');

        if (trial.trialees.length > 0) {
            // Use cached members only — must call showModal within 3s, so avoid awaiting fetches here.
            const options = trial.trialees.map(userId => {
                const member = interaction.guild.members.cache.get(userId);
                return new StringSelectMenuOptionBuilder().setLabel(member?.displayName ?? userId).setValue(userId);
            });

            const passedSelect = new StringSelectMenuBuilder()
                .setCustomId('passed_select')
                .setPlaceholder('Select trialees who passed (leave empty if none)')
                .addOptions(options)
                .setRequired(false)
                .setMinValues(0)
                .setMaxValues(trial.trialees.length);

            modal.addLabelComponents(label => label.setLabel('Who passed? (unselected = failed)').setStringSelectMenuComponent(passedSelect));
        }

        const extraFillsSelect = new UserSelectMenuBuilder()
            .setCustomId('extra_fills')
            .setRequired(false)
            .setMaxValues(5);

        modal.addLabelComponents(label => label.setLabel('Add extra fills for points (optional)').setUserSelectMenuComponent(extraFillsSelect));

        const summaryInput = new TextInputBuilder()
            .setCustomId('summary')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000);

        modal.addLabelComponents(label => label.setLabel('Summary (optional)').setTextInputComponent(summaryInput));

        await interaction.showModal(modal);
    }

    private async handleFinishSubmit(idStr: string): Promise<void> {
        const interaction = this.interaction as ModalSubmitInteraction;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const trial = await this.getTrial(idStr);
        if (!trial || trial.status !== 'scheduled') {
            await interaction.editReply('This scheduled trial is no longer available.');
            return;
        }

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply('This can only be used in a server.');
            return;
        }

        let passedIds: string[] = [];
        if (trial.trialees.length > 0) {
            try {
                passedIds = [...interaction.fields.getStringSelectValues('passed_select')];
            } catch (err) {
                passedIds = [];
            }
        }
        passedIds = passedIds.filter(userId => trial.trialees.includes(userId));
        const failedIds = trial.trialees.filter(userId => !passedIds.includes(userId));
        const summary = interaction.fields.getTextInputValue('summary');

        // Signed-up fills + any extra fills added at finish (e.g. outside the trial team) — all get leaderboard points.
        let extraFillIds: string[] = [];
        try {
            const selected = interaction.fields.getSelectedUsers('extra_fills', false);
            extraFillIds = selected ? selected.map(user => user.id) : [];
        } catch (err) {
            extraFillIds = [];
        }
        const allFills = [...new Set([...(trial.fills ?? []), ...extraFillIds])];

        const hostMember = interaction.member as GuildMember;
        const resultLines: string[] = [];

        for (const passId of passedIds) {
            const trialeeMember = await guild.members.fetch(passId).catch(() => null);
            if (!trialeeMember) {
                resultLines.push(`Could not find <@${passId}>.`);
                continue;
            }
            const result = await HostHandler.awardTrialPass(this.client, hostMember, trialeeMember, trial.tier, null);
            resultLines.push(`<@${passId}>: ${result ?? 'No role changes.'}`);
        }

        // Leaderboard points scale with the number of trialees; grandmaster trials are worth 2x per trialee.
        const pointsPerParticipant = trial.trialees.length * (this.client.util.isGrandmasterTrialTier(trial.tier) ? 2 : 1);
        if (pointsPerParticipant > 0) {
            // host + all fills (saveHost skips anyone already counted as host).
            await HostHandler.saveHost(this.client, 2, null, [trial.hostId], allFills, pointsPerParticipant).catch((err) => {
                this.client.logger.error({ message: 'Scheduled trial saveHost failed', error: err, handler: this.constructor.name });
            });
        }

        try {
            const loungeId = this.client.channelIds.trialLounge;
            if (loungeId) {
                const lounge = await this.client.channels.fetch(loungeId) as TextChannel;
                const tierLabel = HostHandler.trialRoleKeyToLabel(trial.tier);
                const kindLabel = trial.kind === 'ticket' ? '' : 'Scheduled ';
                const container = this.client.cv2.getContainerBuilder(null, `${kindLabel}${tierLabel} Trial hosted by <@${hostMember.id}> - Summary`);
                container.addTextDisplayComponents(t => t.setContent(`### Host:\n<@${trial.hostId}>`));
                container.addTextDisplayComponents(t => t.setContent(`### Fills:\n${allFills.length ? allFills.map(userId => `<@${userId}>`).join('\n') : '_None_'}`));
                container.addTextDisplayComponents(t => t.setContent(`### Passed:\n${passedIds.length ? passedIds.map(userId => `<@${userId}>`).join('\n') : '_None_'}`));
                container.addTextDisplayComponents(t => t.setContent(`### Failed:\n${failedIds.length ? failedIds.map(userId => `<@${userId}>`).join('\n') : '_None_'}`));
                container.addSeparatorComponents(s => s.setSpacing(SeparatorSpacingSize.Small));
                if (summary) container.addTextDisplayComponents(t => t.setContent(summary));
                await lounge.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
            }
        } catch (err) {
            this.client.logger.error({ message: 'Scheduled trial summary failed', error: err, handler: this.constructor.name });
        }

        trial.status = 'completed';
        await this.repo.save(trial);
        await this.deleteCard(trial);

        await interaction.editReply(resultLines.length ? resultLines.join('\n') : 'Trial finished. No trialees were marked as passed.');
    }
}

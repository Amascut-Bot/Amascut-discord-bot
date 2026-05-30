import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, MessageFlags } from 'discord.js';
import HostHandler from '../../modules/HostHandler';
import ScheduledTrialHandler from '../../modules/ScheduledTrialHandler';
import { ScheduledTrial } from '../../entity/ScheduledTrial';

// Tiers that can be scheduled (highest-supported trial tiers, mirrors AssignMatchmaking)
const SCHEDULABLE_TIERS = ['elite1000', 'elite2000', 'master1000', 'master2000', 'grandmaster2000'];

export default class ScheduleTrial extends BotInteraction {
    get name() {
        return 'schedule-trial';
    }

    get description() {
        return 'Schedule an anonymous trial that trialees can sign up for';
    }

    get permissions() {
        return 'TRIAL_TEAM';
    }

    get tierOptions() {
        return SCHEDULABLE_TIERS.map((tier) => ({ name: HostHandler.trialRoleKeyToLabel(tier), value: tier }));
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('tier').setDescription('Trial tier to schedule').setChoices(...this.tierOptions).setRequired(true))
            .addStringOption((option) => option.setName('in-game-time').setDescription('In-game (UTC) start time, format: YYYY-MM-DD HH:MM').setRequired(true))
            .addIntegerOption((option) => option.setName('max-trialees').setDescription('Maximum number of trialees that can sign up').setMinValue(1).setMaxValue(25).setRequired(true))
            .addStringOption((option) => option.setName('message').setDescription('Optional additional message').setMaxLength(500).setRequired(false));
    }

    /**
     * Parses an in-game (UTC) "YYYY-MM-DD HH:MM" string into a Date, or null if invalid.
     */
    private parseInGameTime(input: string): Date | null {
        const match = input.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/);
        if (!match) return null;

        const [, year, month, day, hour, minute] = match.map(Number);
        const timestamp = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
        const date = new Date(timestamp);

        // Guard against rollover (e.g. month 13 / day 32)
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

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.guild) {
            return await interaction.editReply('This command can only be used in a server.');
        }

        const tier = interaction.options.getString('tier', true);
        const inGameTimeInput = interaction.options.getString('in-game-time', true);
        const maxTrialees = interaction.options.getInteger('max-trialees', true);
        const message = interaction.options.getString('message', false);

        const scheduledTime = this.parseInGameTime(inGameTimeInput);
        if (!scheduledTime) {
            return await interaction.editReply('Could not read that time. Use the in-game (UTC) format `YYYY-MM-DD HH:MM`, e.g. `2026-06-01 18:30`.');
        }

        if (scheduledTime.getTime() <= Date.now()) {
            return await interaction.editReply('That time is in the past. Please pick a future in-game (UTC) time.');
        }

        const channelId = this.client.channelIds.trialScheduling;
        if (!channelId) {
            return await interaction.editReply('No trial scheduling channel is configured for this server.');
        }

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null) as TextChannel | null;
        if (!channel) {
            return await interaction.editReply('Could not find the trial scheduling channel.');
        }

        const repository = this.client.dataSource.getRepository(ScheduledTrial);

        const scheduledTrial = new ScheduledTrial();
        scheduledTrial.guildId = interaction.guild.id;
        scheduledTrial.channelId = channel.id;
        scheduledTrial.messageId = null;
        scheduledTrial.hostId = interaction.user.id;
        scheduledTrial.tier = tier;
        scheduledTrial.scheduledTime = scheduledTime;
        scheduledTrial.maxTrialees = maxTrialees;
        scheduledTrial.trialees = [];
        scheduledTrial.message = message ?? null;
        scheduledTrial.reminderSent = false;
        scheduledTrial.status = 'scheduled';

        const saved = await repository.save(scheduledTrial);

        const card = ScheduledTrialHandler.buildCard(this.client, saved);
        const cardMessage = await channel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        });

        saved.messageId = cardMessage.id;
        await repository.save(saved);

        return await interaction.editReply(`Trial scheduled! Head over to <#${channel.id}> to find the sign-up card.`);
    }
}

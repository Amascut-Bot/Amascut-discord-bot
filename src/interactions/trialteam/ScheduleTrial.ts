import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import HostHandler from '../../modules/HostHandler';

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
            .addIntegerOption((option) => option.setName('max-trialees').setDescription('Maximum number of trialees that can sign up').setMinValue(1).setMaxValue(25).setRequired(true));
    }

    /**
     * Current UTC time rounded down to the minute, as a "YYYY-MM-DD HH:MM" string,
     * used to pre-fill the (editable) time field in the modal.
     */
    private currentInGameMinute(): string {
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, '0');
        return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
    }

    async run(interaction: ChatInputCommandInteraction) {
        const tier = interaction.options.getString('tier', true);
        const maxTrialees = interaction.options.getInteger('max-trialees', true);

        const modal = new ModalBuilder()
            .setCustomId(`schedtrial_createmodal_${tier}_${maxTrialees}`)
            .setTitle('Schedule Trial');

        const timeInput = new TextInputBuilder()
            .setCustomId('in_game_time')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(this.currentInGameMinute())
            .setMaxLength(20);

        modal.addLabelComponents(label => label
            .setLabel('In-game (UTC) time — YYYY-MM-DD HH:MM')
            .setTextInputComponent(timeInput)
        );

        const messageInput = new TextInputBuilder()
            .setCustomId('message')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500);

        modal.addLabelComponents(label => label
            .setLabel('Additional message (optional)')
            .setTextInputComponent(messageInput)
        );

        return await interaction.showModal(modal);
    }
}

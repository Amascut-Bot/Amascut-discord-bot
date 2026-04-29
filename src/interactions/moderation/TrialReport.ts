import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, Events, ModalSubmitInteraction, SlashCommandBuilder } from 'discord.js';
import ReportHandler from '../../modules/ReportHandler';

export default class Report extends BotInteraction {
    get name() {
        return 'trialreport';
    }

    get description() {
        return 'Report a user for trial role';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
    }

    // Register event listener once when bot loads
    register() {
        this.client.on(Events.InteractionCreate, (interaction) => {
            if (!interaction.isModalSubmit()) return;
            if (!interaction.customId.startsWith('report_submitModal')) return;
            new ReportHandler(this.client, interaction.customId, interaction);
        });
    }

    async run(interaction: ChatInputCommandInteraction) {
        new ReportHandler(this.client, 'report_submit', interaction);
    }
}
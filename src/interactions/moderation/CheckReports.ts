import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import ReportHandler from '../../modules/ReportHandler';

export default class CheckReports extends BotInteraction {
    get name() {
        return 'checkreports';
    }

    get description() {
        return 'Check how many reports a user has for trial roles';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
    }

    async run(interaction: ChatInputCommandInteraction) {
        new ReportHandler(this.client, 'checkreports_submit', interaction);
    }
}
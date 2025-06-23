import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default class Ping extends BotInteraction {
    get name() {
        return 'ping';
    }

    get description() {
        return 'Basic pongy command!';
    }

    get slashData() {
        return new SlashCommandBuilder().setName(this.name).setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        const pingTime = Date.now();
        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply(`Took \`${Date.now() - pingTime}ms\``);
    }
}

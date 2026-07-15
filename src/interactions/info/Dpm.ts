import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';

export default class Dpm extends BotInteraction {
    get name() {
        return 'dpm';
    }

    get description() {
        return 'Calculate damage per minute from a damage total and a time in seconds.';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addNumberOption((option) => option.setName('damage').setDescription('Total damage dealt').setRequired(true).setMinValue(0))
            .addNumberOption((option) => option.setName('time').setDescription('Kill time in seconds').setRequired(true).setMinValue(0));
    }

    async run(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply();

        const damage: number = interaction.options.getNumber('damage', true);
        const time: number = interaction.options.getNumber('time', true);

        if (time <= 0) {
            await interaction.editReply('Time must be greater than 0 seconds.');
            return;
        }

        const dpm = (damage / time) * 60;

        const embed = new EmbedBuilder()
            .setColor(this.client.color ?? 10454367)
            .setTitle('Damage Per Minute')
            .addFields(
                { name: 'Damage', value: damage.toLocaleString('en-US'), inline: true },
                { name: 'Time', value: `${time.toLocaleString('en-US')}s`, inline: true },
                { name: 'DPM', value: `${Math.round(dpm).toLocaleString('en-US')}`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
}

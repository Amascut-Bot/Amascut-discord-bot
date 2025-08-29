import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

export default class UpdateBossKph extends BotInteraction {
    get name() {
        return 'update-boss-kph';
    }

    get description() {
        return 'Update KPH (kills per hour) for boss revenue calculations';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('boss')
                    .setDescription('Boss name')
                    .setRequired(true)
                    .addChoices({ name: 'Raksha', value: 'raksha' })
            )
            .addNumberOption(option =>
                option.setName('kph')
                    .setDescription('New kills per hour value')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(100)
            );
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.inCachedGuild()) return;

        await interaction.deferReply({ ephemeral: true });

        const boss = interaction.options.getString('boss', true);
        const newKph = interaction.options.getNumber('kph', true);
        const { colours } = this.client.util;

        try {
            const configPath = path.join(process.cwd(), 'boss-configs.json');
            let configData: any = {};

            try {
                const configFile = fs.readFileSync(configPath, 'utf8');
                configData = JSON.parse(configFile);
            } catch (error) {
                configData = {};
            }

            if (!configData[boss]) {
                configData[boss] = {};
            }

            configData[boss].kph = newKph;
            configData[boss].lastUpdated = new Date().toISOString().split('T')[0];

            fs.writeFileSync(configPath, JSON.stringify(configData, null, 4));

            await interaction.editReply({ content: `Successfully updated ${boss} KPH to ${newKph}.` });

        } catch (error) {
            this.client.logger.error({ message: 'Error updating boss KPH', error });

            const errorEmbed = new EmbedBuilder()
                .setColor(colours.discord.red)
                .setDescription('Failed to update boss KPH. Please try again later.');

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
}

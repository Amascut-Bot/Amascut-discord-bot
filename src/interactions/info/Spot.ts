import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { EventParticipant } from '../../modules/GoogleSheetsHandler';

export default class Spot extends BotInteraction {
    get name() {
        return 'spot';
    }

    get description() {
        return 'Check your position in the Amascut event queue';
    }

    get permissions() {
        return "0";
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const userDiscordName = interaction.user.username;

        try {
            // Get raw sheet data to find row numbers
            const sheetId = '1I4VgXusgdouIyX2b52pukUfrTSca10xHW8EPTmb5x_s';
            const rows = await this.client.googleSheetsHandler.readSheet(sheetId, 'A:J');

            if (rows.length < 3) {
                return interaction.editReply('No participants found in the event sheet.');
            }

            // Search for the user's Discord name in column C (index 2)
            // Skip header rows (row 1 has headers, row 2 has color coding info)
            let foundRowNumber: number | null = null;
            let foundParticipant: EventParticipant | null = null;

            for (let i = 2; i < rows.length; i++) { // Start from row 3 (index 2)
                const row = rows[i];
                if (!row || row.length < 2) continue;

                const discordName = row[2] || ''; // Column C - Discord Name
                
                // Check for exact match or partial match (case insensitive)
                if (discordName.toLowerCase().includes(userDiscordName.toLowerCase()) || 
                    userDiscordName.toLowerCase().includes(discordName.toLowerCase())) {
                    
                    foundRowNumber = i + 1; // Convert to 1-based row number
                    foundParticipant = {
                        timestamp: row[0] || '',
                        rsn: row[1] || '',
                        discordName: row[2] || '',
                        availability: row[3] || '',
                        enrageLevel: row[4] || '',
                        voiceChat: row[5] || '',
                        streamConsent: row[6] || '',
                        additionalNotes: row[7] || '',
                        discordStatus: row[8] || '',
                        team: row[9] || ''
                    };
                    break;
                }
            }

            if (!foundRowNumber || !foundParticipant) {
                const embed = new EmbedBuilder()
                    .setTitle('Not Found')
                    .setDescription(`Your Discord username "${userDiscordName}" was not found in the event sheet.`)
                    .setColor(0xff0000)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // Create simple embed
            const embed = new EmbedBuilder()
                .setTitle('Amascut Community Event')
                .setDescription(`Your sign up number is: **${foundRowNumber}**\n\n**Please note:** *Today will be using a raffle system, with kills alternating between signups 1-300 and 1-end of list, so anyone can get selected but it's more likely for those who have waited the longest*`)
                .setColor(this.client.color)
                .setThumbnail('https://cdn.discordapp.com/icons/885457551397912596/c34dc71adda5f7e5c90e3b94a8c6e7c1.webp?size=128');

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            this.client.logger.error({
                message: 'Failed to check user spot in event sheet',
                error,
                handler: this.constructor.name
            });

            await interaction.editReply('Failed to check your spot. Please try again later.');
        }
    }
}

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { EventParticipant } from '../../modules/GoogleSheetsHandler';

export default class EventParticipants extends BotInteraction {
    get name() {
        return 'spot';
    }

    get description() {
        return 'Check your position in the Amascut event queue';
    }

    get permissions() {
        return "0";
    }

    get slashCommand() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('sheet-id')
                    .setDescription('Custom sheet ID (optional)')
                    .setRequired(false)
            );
    }

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const customSheetId = interaction.options.getString('sheet-id');
        const userDiscordName = interaction.user.username;

        try {
            // Get raw sheet data to find row numbers
            const sheetId = customSheetId || '1I4VgXusgdouIyX2b52pukUfrTSca10xHW8EPTmb5x_s';
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
                    .setTitle('❌ Not Found')
                    .setDescription(`Your Discord username "${userDiscordName}" was not found in the event sheet.`)
                    .setColor(0xff0000)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('✅ Found Your Spot!')
                .setDescription(`You are in **row ${foundRowNumber}** of the event sheet.`)
                .setColor(this.client.color)
                .setTimestamp();

            // Add participant details
            embed.addFields(
                { name: 'RSN', value: foundParticipant.rsn || 'Not provided', inline: true },
                { name: 'Discord Name', value: foundParticipant.discordName || 'Not provided', inline: true },
                { name: 'Team Assignment', value: foundParticipant.team || 'Unassigned', inline: true }
            );

            if (foundParticipant.availability) {
                embed.addFields({ name: 'Availability', value: foundParticipant.availability, inline: false });
            }

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

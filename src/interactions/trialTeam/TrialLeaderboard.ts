import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Trial } from '../../entity/Trial';
import { TrialParticipation } from '../../entity/TrialParticipation';
import { getRoles } from '../../GuildSpecifics';

export default class TrialLeaderboard extends BotInteraction {
    get name() {
        return 'trial-leaderboard';
    }

    get description() {
        return 'Trial Team Leaderboards';
    }

    get permissions() {
        return 'TRIAL_TEAM';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('timespan')
                    .setDescription('The timespan for the leaderboard.')
                    .setRequired(true)
                    .setAutocomplete(true));
    }

    public createFieldFromArray = (array: any[]) => {
        const { gem1, gem2, gem3 } = this.client.util.emojis;
        let field = '';
        if (array.length === 0) return 'None';
        const filteredArray = array.filter(item => !item.user.includes("Placeholder"));
        if (filteredArray.length === 0) return 'None';
        filteredArray.forEach((item, index) => {
            let prefix: string;
            switch (index) {
                case 0:
                    prefix = gem1;
                    break;
                case 1:
                    prefix = gem2
                    break;
                case 2:
                    prefix = gem3
                    break;
                default:
                    prefix = '⬥'
                    break;
            }
            field += `${prefix} <@${item.user}> - **${item.count}**\n`
        })
        return field;
    }

    async autocomplete(interaction: any) {
        const focusedOption = interaction.options.getFocused(true);
        let choices: string[] = [];
        if (focusedOption.name === 'timespan') {
            choices = ['Current Month', 'Last Month', 'Last 3 Months', 'Current Year', 'Last Year', 'All Time'];
        }

        const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })),
        );
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: false });
        const { dataSource } = this.client;
        const { colours } = this.client.util;
        const timespan = interaction.options.getString('timespan', true);

        const now = new Date();
        let startDate: Date | null = null;

        switch (timespan) {
            case 'Current Month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'Last Month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                now.setDate(0); // End of last month
                break;
            case 'Last 3 Months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                break;
            case 'Current Year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'Last Year':
                startDate = new Date(now.getFullYear() - 1, 0, 1);
                now.setFullYear(now.getFullYear() -1, 11, 31);
                break;
            case 'All Time':
            default:
                // No start date needed for all time
                break;
        }

        const trialsHostedQuery = dataSource.createQueryBuilder()
            .select('trial.host', 'user')
            .addSelect('COUNT(*)', 'count')
            .from(Trial, 'trial')
            .groupBy('trial.host')
            .orderBy('count', 'DESC');

        const trialsParticipatedQuery = dataSource.createQueryBuilder()
            .select('trialParticipation.participant', 'user')
            .addSelect('COUNT(*)', 'count')
            .from(TrialParticipation, 'trialParticipation')
            .leftJoin(Trial, 'trial', 'trial.id = trialParticipation.trialId')
            .groupBy('trialParticipation.participant')
            .orderBy('count', 'DESC');

        if (startDate) {
            trialsHostedQuery.where('trial.created_at >= :startDate', { startDate });
            trialsParticipatedQuery.where('trial.created_at >= :startDate', { startDate });
        }

        const trialsHosted = await trialsHostedQuery.getRawMany();
        const trialsParticipated = await trialsParticipatedQuery.getRawMany();

        // Get total trials without making another database call
        let totalTrials = 0;
        trialsHosted.forEach((trial: any) => {
            totalTrials += trial.count;
        })

        const embed = new EmbedBuilder()
            .setTimestamp()
            .setTitle(`Amascut Trial Team Leaderboard - ${timespan}`)
            .setColor(this.client.color)
            .setDescription(`> There has been **${totalTrials}** trial${totalTrials !== 1 ? 's' : ''} recorded and **${trialsParticipated.length}** unique ${getRoles(interaction.guild?.id).trialTeam} members!`)
            .addFields(
                { name: 'Trials Hosted', value: this.createFieldFromArray(trialsHosted.slice(0, 10)), inline: true },
                { name: 'Trials Participated', value: this.createFieldFromArray(trialsParticipated.slice(0, 10)), inline: true }
            )

        await interaction.editReply({ embeds: [embed] });
    }
}

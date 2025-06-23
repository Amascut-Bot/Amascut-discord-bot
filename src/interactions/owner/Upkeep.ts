import BotInteraction from '../../types/BotInteraction';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Trial } from '../../entity/Trial';
import { TrialParticipation } from '../../entity/TrialParticipation';

export default class Upkeep extends BotInteraction {
    get name() {
        return 'upkeep';
    }

    get description() {
        return 'Trial Team Upkeep';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get slashData() {
        return new SlashCommandBuilder().setName(this.name).setDescription(this.description);
    }

    public dateValue = (dateInMs: number): number => {
        return Math.round(dateInMs / 1000)
    }

    public getUpkeepMembers = async (pastDate: Date, interaction: ChatInputCommandInteraction) => {
        const { dataSource } = this.client;
        const { roles, stripRole } = this.client.util;
        // Get all trials since pastDate but only grab the first 10
        const trialsParticipated = await dataSource.createQueryBuilder()
            .select('trialParticipation.participant', 'user')
            .addSelect('COUNT(*)', 'count')
            .from(TrialParticipation, 'trialParticipation')
            .where('trialParticipation.createdAt > :pastDate', { pastDate })
            .groupBy('trialParticipation.participant')
            .orderBy('count', 'DESC')
            .getRawMany();

        // Process result into a key value pair
        const participation: any = {}
        trialsParticipated.forEach((trial: any) => {
            participation[trial.user] = trial.count;
        })

        const trialTeamMembers = await interaction.guild?.members.fetch().then(members => {
            return members.filter(member => member.roles.cache.has(stripRole(roles.trialTeam))).map(member => member.id)
        });

        const sortableArray: any = [];
        trialTeamMembers?.forEach(userId => {
            if (participation[userId]) {
                sortableArray.push([userId, participation[userId]]);
            } else {
                sortableArray.push([userId, 0]);
            }
        });
        sortableArray.sort((a: any, b: any) => b[1] - a[1]);
        return sortableArray;
    }

    public createUpkeepString = (members: any) => {
        let fieldString = '';
        members.slice(0, 10).forEach((member: any) => {
            fieldString += `⬥ <@${member[0]}> - **${member[1]}**\n`
        })
        return fieldString;
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: false });
        const { dataSource } = this.client;
        const { colours } = this.client.util;

        // Get 30 days prior.
        const currentDate = new Date();
        const pastDate = new Date();
        pastDate.setDate(currentDate.getDate() - 30);
        const date = this.dateValue(pastDate.getTime());

        // Get total trials since pastDate
        const totalTrials = await dataSource.createQueryBuilder()
            .from(Trial, 'trial')
            .where('trial.createdAt > :pastDate', { pastDate })
            .getCount();


        const upkeepMembers = await this.getUpkeepMembers(pastDate, interaction);

        const numberOfMembers = upkeepMembers.length;
        const navigation = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('nextUpkeep')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
            );

        const fieldString = this.createUpkeepString(upkeepMembers);

        const components = numberOfMembers > 10 ? [navigation] : [];

        const embed = new EmbedBuilder()
            .setTimestamp()
            .setTitle('Trial Team Upkeep')
            .setColor(colours.gold)
            .setFooter({ text: `Page 1 of ${Math.ceil(numberOfMembers / 10)}` })
            .setDescription(`
            > There has been **${totalTrials}** trial${totalTrials !== 1 ? 's' : ''} since <t:${date}:D>.\n
            ${fieldString}
            `)

        await interaction.editReply({ embeds: [embed], components: components });
    }
}

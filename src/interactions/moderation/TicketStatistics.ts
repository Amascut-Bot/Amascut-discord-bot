import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, User, ContainerBuilder, TextDisplayBuilder, SeparatorSpacingSize } from 'discord.js';
import { Ticket } from '../../entity/Ticket';

export default class TicketStatistics extends BotInteraction {

    get name() {
        return 'ticket-statistics';
    }

    get description() {
        return 'Gets various ticket statistics';
    }

    get permissions() {
        return 'ADMIN';
    }

    // 0 = Suggestion, 1 = Report, 2 = Content Creator, 3 = Other
    get ticketTypeOptions() {
        const ticketTypes: any = {
            'Suggestion': 0,
            'Report': 1,
            'Content Creator': 2,
            'Other': 3,
            'Clearance': 4,
            'Learner': 5,
            'Librarian' : 6,
            'Fill': 7,
            'Teacher': 8,
            'Verified': 9
        }
        const options: any = [];
        Object.keys(ticketTypes).forEach((key: string) => {
            options.push({ name: key, value: ticketTypes[key] })
        })
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addNumberOption((option) => option.setName('type').setDescription('What Type of Ticket to analyse').addChoices(...this.ticketTypeOptions).setRequired(false))
            .addStringOption((option) => option.setName('timefrom').setDescription('Start Time. Must be in the format YYYY-MM-DD HH:MM in Gametime. e.g. 2022-11-05 06:00').setRequired(false))
            .addStringOption((option) => option.setName('timeto').setDescription('End Time. Must be in the format YYYY-MM-DD HH:MM in Gametime. e.g. 2022-11-05 06:00').setRequired(false))
            .addUserOption((option) => option.setName('useropen').setDescription('Tickets a specific user opened').setRequired(false))
            .addUserOption((option) => option.setName('userclose').setDescription('Tickets a specific user closed').setRequired(false))
            .addBooleanOption((option) => option.setName('detailed').setDescription('Instead of counts, receive a detailled list').setRequired(false));
    }

    public parseTime = (timeString: string): Date => {
        const [date, time] = timeString.split(' ');
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        return new Date(Date.UTC(year, month - 1, day, hours, minutes));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const { dataSource } = this.client;

        const type: number | null = interaction.options.getNumber('type', false);
        const timeFrom: string | null = interaction.options.getString('timefrom', false);
        const timeTo: string | null = interaction.options.getString('timeto', false);
        const userOpen: User | null = interaction.options.getUser('useropen', false);
        const userClose: User | null = interaction.options.getUser('userclose', false);
        const detailed: boolean = interaction.options.getBoolean('detailed', false) ?? false;

        // By default check current month
        let timestamp: Date = new Date();
        let dateFrom = new Date(timestamp.getFullYear(), timestamp.getMonth(), 1, 0, 0, 0);
        let dateTo = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 23, 59, 59);

        if (timeFrom != null){
            dateFrom = this.parseTime(timeFrom);
        }

        if (timeTo != null){
            dateTo = this.parseTime(timeTo);
        }

        const queryBuilder = dataSource.createQueryBuilder(Ticket, 'ticket');


        if (detailed) {
            queryBuilder.addSelect('ticket.ticketType', 'type')
                        .addSelect('ticket.forumPostId', 'forumPostId')
                        .addSelect('ticket.userClose', 'userClose')
                        .addSelect('ticket.userOpen', 'userOpen')
                        .addSelect('ticket.updatedAt', 'updatedAt')
                        .where(`ticket.createdAt BETWEEN :dateFrom AND :dateTo`, {dateFrom, dateTo})
                        .orderBy('ticketType', 'ASC')
                        .addOrderBy('ticket.userOpen', 'ASC');
        } else {
            queryBuilder.addSelect('ticket.ticketType', 'type')
                        .addSelect('COUNT(*)', 'count')
                        .where(`ticket.createdAt BETWEEN :dateFrom AND :dateTo`, {dateFrom, dateTo})
                        .groupBy('ticket.ticketType')
                        .orderBy('count', 'DESC');
        }

        if (userOpen) {
            queryBuilder.andWhere(`userOpen = '${userOpen.id}'`);
        }

        if (userClose) {
            queryBuilder.andWhere(`userClose = '${userClose.id}'`);
        }

        if (type != null) {
            queryBuilder.andWhere(`ticketType = ${type}`);
        }

        const tickets = await queryBuilder.getRawMany();

        let message: string = tickets.length > 0 ? '' : 'No Tickets found';
        tickets.forEach(ticket => {
            const ticketType = ticket.type;

            if (detailed) {
                message += `Ticket Type: ${(ticketType === 0 ? 'Suggestion' : ticketType === 1 ? 'Report' : ticketType === 2 ? 'Content Creator' : ticketType === 4 ? 'Clearance' : ticketType === 5 ? 'Learner' : ticketType === 6 ? 'Librarian' :
                    ticketType === 7 ? 'Fill' : ticketType === 8 ? 'Teacher' : ticketType === 9 ? 'Verified' : 'Other' )} | Opened by: <@${ticket.userOpen}> | Closed by: <@${ticket.userClose}> | Archive: <#${ticket.forumPostId}>\n`;
            } else {
                message += `Ticket Type: ${(ticketType === 0 ? 'Suggestion' : ticketType === 1 ? 'Report' : ticketType === 2 ? 'Content Creator' : ticketType === 4 ? 'Clearance' : ticketType === 5 ? 'Learner' : ticketType === 6 ? 'Librarian' :
                    ticketType === 7 ? 'Fill' : ticketType === 8 ? 'Teacher' : ticketType === 9 ? 'Verified' : 'Other' )} | Ticket Count: ${ticket.count}\n`;
            }
        });

        message = message.trim();

        const container = new ContainerBuilder();

        container.setAccentColor(this.client.color);

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Ticket Statistics ${detailed ? ' - Detailed' : ''}`));
        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
                '### Filters:',
                `> Ticket Stats from <t:${Math.round(dateFrom.getTime() / 1000)}:f> to <t:${Math.round(dateTo.getTime() / 1000)}:f>.`,
                userOpen ? `> Opening User: <@${userOpen.id}>` : '',
                userClose ? `> Closing User: <@${userClose.id}>` : '',
                type != null ? '> Ticket-Type: ' + (type === 0 ? 'Suggestion' : type === 1 ? 'Report' : type === 2 ? 'Content Creator' : type === 4 ? 'Clearance' : type === 5 ? 'Learner' : 'Other') : '',
                !userOpen && !userClose && type == null ? '> No additional Filter specified' : '',
            ].filter(str => str.trim() !== '').join('\n').trim()));
        container.addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Large));

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(message));

        return await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: {"parse": [] }});
    }
}

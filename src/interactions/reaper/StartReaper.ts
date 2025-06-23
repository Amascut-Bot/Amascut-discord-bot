import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Message, ButtonBuilder, ActionRowBuilder, ButtonStyle, TextChannel } from 'discord.js';

interface EmbedContent {
    [key: string]: string;
}

export default class StartReaper extends BotInteraction {
    get name() {
        return 'start-reaper';
    }

    get description() {
        return 'Starts a Reaper card from within a reaper ticket.';
    }

    get permissions() {
        return 'REAPER';
    }

    get regionOptions() {
        const assignOptions: any = {
            'North America (East)': 'NA East',
            'North America (West)': 'NA West',
            'Europe': 'Europe',
            'Oceania': 'Oceania'
        }
        const options: any = [];
        Object.keys(assignOptions).forEach((key: string) => {
            options.push({ name: key, value: assignOptions[key] })
        })
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('region').setDescription('Reaper world').addChoices(
                ...this.regionOptions
            ).setRequired(true))
            .addStringOption((option) => option.setName('time').setDescription('Time of Reaper event. Must be in the format YYYY-MM-DD HH:MM in Gametime. e.g. 2022-11-05 06:00').setRequired(false))
    }

    public ticketToolEmbedContent = async (interaction: ChatInputCommandInteraction) => {

        const content: EmbedContent = {
            rsn: '',
            id: '',
        }

        const cleanValueFromDescription = (description: string, pattern: RegExp, index: number, key: string) => {
            const regex = description ? description.match(pattern) : [];
            const dirty = regex ? regex[0] : '';
            const stripped = dirty.replace(/\s+/g, '');
            content[key] = stripped.slice(index, -3);
        }

        try {
            const messages = await interaction.channel?.messages.fetchPinned();
            if (!messages) return;
            // Get correct message
            let message: Message | null = null;
            for (const [_id, item] of messages) {
                if (item.author.bot === true) {
                    message = item;
                    break;
                }
            }
            if (!message) return;
            const description = message.embeds[0].description || '';
            if (!description) return;
            // RSN
            cleanValueFromDescription(description, /\*{2}RSN\*{2}\n```.+/gm, 10, 'rsn');
            // Discord ID
            cleanValueFromDescription(description, /\*{2}Discord ID\*{2}\n```.+/gm, 16, 'id');
        } catch {
            return content
        }
        return content
    }

    public parseTime = (timeString: string): string => {
        const [date, time] = timeString.split(' ');
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const gametime = new Date(Date.UTC(year, month - 1, day, hours, minutes))
        return `<t:${Math.round(gametime.getTime() / 1000)}:f>`;
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const region: string = interaction.options.getString('region', true);
        const time: string | null = interaction.options.getString('time', false);

        const { roles, colours, channels } = this.client.util;

        const info = await this.ticketToolEmbedContent(interaction);

        const expression = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

        let errorMessage = '';

        if (!info) {
            errorMessage += 'There was an issue with grabbing **Ticket Tool** data. Please check if the message is pinned.'
        }

        if (time) {
            const isValid = expression.test(time);
            if (!isValid) {
                errorMessage += '\n\nThe reaper `time` was not in the expected format.'
            }
        }

        const errorEmbed = new EmbedBuilder()
            .setTitle('Something went wrong!')
            .setColor(colours.discord.red)
            .setDescription(errorMessage || 'No error message.');
        if (!info) return await interaction.editReply({ embeds: [errorEmbed] });
        if (time) {
            const isValid = expression.test(time);
            console.log(isValid)
            if (!isValid) {
                return await interaction.editReply({ embeds: [errorEmbed] });
            }
        }

        const groupButtonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('selectBase')
                    .setLabel('Base')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('selectOutside')
                    .setLabel('Outside')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('selectElf')
                    .setLabel('Elf')
                    .setStyle(ButtonStyle.Secondary)
            );

        const controlPanel = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('startReaper')
                    .setLabel('Start Reaper')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('disbandReaper')
                    .setLabel('Disband')
                    .setStyle(ButtonStyle.Danger)
            );

        const fields = [
            { name: 'Base', value: '`Empty`', inline: true },
            { name: 'Outside', value: `<@${info.id}> (Reaper)`, inline: true },
            { name: 'Outside', value: '`Empty`', inline: true },
            { name: 'Elf', value: '`Empty`', inline: true },
            { name: 'Elf', value: '`Empty`', inline: true },
        ]
        const cardEmbed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || this.client.user?.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png' })
            .setColor(colours.tan)
            .setDescription(`
            > **General**\n
            \`Host:\` <@${interaction.user.id}>
            ${time ?
                    `\`Game Time:\` \`${time}\`
            \`Local Time:\` ${this.parseTime(time)}`
                    :
                    `\`Time:\` \`ASAP\``}
            \`Region:\` ${region}
            \`Ticket:\` <#${interaction.channel?.id}>\n
            > **Recipient**\n
            \`RSN:\` ${info.rsn}
            \`Discord:\` <@${info.id}>\n
            > **Team**
            `)
            .addFields(fields);

        const channel = await this.client.channels.fetch(channels.reaperScheduling) as TextChannel;
        await channel.send(
            { content: `${roles['reaper']}`, embeds: [cardEmbed], components: [groupButtonRow, controlPanel] }
        )

        const replyEmbed = new EmbedBuilder()
            .setTitle('Reaper card created!')
            .setColor(colours.discord.green)
            .setDescription(`${roles['reaper']} has been notified in <#${channels.reaperScheduling}>`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}
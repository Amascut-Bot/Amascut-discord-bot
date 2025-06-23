import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, Message, ButtonBuilder, ActionRowBuilder, ButtonStyle, Role, TextChannel } from 'discord.js';

interface EmbedContent {
    [key: string]: string;
}

interface ValidRole {
    [key: string]: string[];
}

interface TrialledRole {
    key: string;
    role: Role;
}

export default class Pass extends BotInteraction {
    get name() {
        return 'start-trial';
    }

    get description() {
        return 'Starts a Trial from within a trial ticket';
    }

    get permissions() {
        return 'TRIAL_TEAM';
    }

    get roleOptions() {
        const assignOptions: any = {
            'Base (Duo/4s/5s)': 'Base',
            'DPS (Duo)': 'DPS',
            'Outside (4s/5s)': 'Outside',
            'Elf (4s/5s)': 'Elf',
        }
        const options: any = [];
        Object.keys(assignOptions).forEach((key: string) => {
            options.push({ name: key, value: assignOptions[key] })
        })
        return options;
    }

    get validBossRolesForTeamSize(): ValidRole {
        return {
            'Duo': ['Base', 'DPS'],
            '3-7': ['Base', 'Outside', 'Elf'],
            '4s': ['Base', 'Outside', 'Elf']
        }
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
            .addStringOption((option) => option.setName('role').setDescription('Trialee preferred role').addChoices(
                ...this.roleOptions
            ).setRequired(true))
            .addStringOption((option) => option.setName('region').setDescription('Trial world').addChoices(
                ...this.regionOptions
            ).setRequired(true))
            .addStringOption((option) => option.setName('time').setDescription('Time of trial. Must be in the format YYYY-MM-DD HH:MM in Gametime. e.g. 2022-11-05 06:00').setRequired(false))
    }

    public ticketToolEmbedContent = async (interaction: ChatInputCommandInteraction) => {

        const content: EmbedContent = {
            rsn: '',
            id: '',
            teamSize: '',
            rank: '',
            preferredRole: ''
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
            // Team Size
            cleanValueFromDescription(description, /\*{2}Team Size\*{2}\n```.+/gm, 15, 'teamSize');
            // Rank
            cleanValueFromDescription(description, /\*{2}Rank\*{2}\n```.+/gm, 11, 'rank');
            // Preferred Role
            cleanValueFromDescription(description, /\*{2}Preferred Role\*{2}\n```.+/gm, 20, 'preferredRole');
        } catch {
            return content
        }
        return content
    }

    public getTrialledRole = async (interaction: ChatInputCommandInteraction, teamSize: string, rank: string): Promise<TrialledRole | undefined> => {

        interface KeyMap {
            [key: string]: string;
        }

        const validTeamsizes = ['Duo', '3-7', '4s'];
        const validRanks = ['Experienced', 'Master', 'Grandmaster', 'Rootskips'];
        if (!validTeamsizes.includes(teamSize) || !validRanks.includes(rank)) return;
        const keyMap: KeyMap = {
            'Duo': 'duo',
            '3-7': 'threeSeven',
            '4s': 'fours',
        }
        let key = `${keyMap[teamSize]}${rank}`;
        if (teamSize === '4s') key = 'fours';
        if (!this.client.util.roles[key]) return;
        const roleObject = await interaction.guild?.roles.fetch(this.client.util.stripRole(this.client.util.roles[key])) as Role;
        return {
            key: this.client.util.roles[key],
            role: roleObject
        };
    }

    public parseTime = (timeString: string): string => {
        const [date, time] = timeString.split(' ');
        const [year, month, day] = date.split('-').map(Number);
        const [hours, minutes] = time.split(':').map(Number);
        const gametime = new Date(Date.UTC(year, month - 1, day, hours, minutes))
        return `<t:${Math.round(gametime.getTime() / 1000)}:f>`;
    }

    public notifyTrialTeam = (rank: string, teamSize: string): string => {
        if (['4s', '3-7'].includes(teamSize)) {
            if (rank === 'Experienced') {
                return this.client.util.roles.notifyExperienced
            } else if (rank === 'Master') {
                return this.client.util.roles.notifyMaster
            } else if (rank === 'Grandmaster' && teamSize !== '4s') {
                return this.client.util.roles.notifyGM
            } else if (teamSize === '4s') {
                return this.client.util.roles.notify4s
            } else {
                return ''
            }
        } else {
            return ''
        }
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const role: string = interaction.options.getString('role', true);
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
                errorMessage += '\n\nThe trial `time` was not in the expected format.'
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

        if (!this.validBossRolesForTeamSize[info.teamSize].includes(role)) {
            errorEmbed.setDescription(`**${role}**  is not a valid role for this team size.`)
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const roleInfo = await this.getTrialledRole(interaction, info.teamSize, info.rank);

        const duoButtonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('selectBase')
                    .setLabel('Base')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('selectDPS')
                    .setLabel('DPS')
                    .setStyle(ButtonStyle.Secondary)
            );

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
                    .setCustomId('startTrial')
                    .setLabel('Start Trial')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('disbandTrial')
                    .setLabel('Disband')
                    .setStyle(ButtonStyle.Danger)
            );

        const checkRole = (roleString: string, info: EmbedContent) => {
            return role === roleString ? `<@${info.id}> (Trialee)` : '`Empty`';
        }

        const duoFields = [
            { name: 'Base', value: checkRole('Base', info), inline: true },
            { name: 'DPS', value: checkRole('DPS', info), inline: true },
        ]

        const groupFields = [
            { name: 'Base', value: checkRole('Base', info), inline: true },
            { name: 'Outside', value: checkRole('Outside', info), inline: true },
            { name: 'Elf', value: checkRole('Elf', info), inline: true },
            { name: 'Elf', value: '`Empty`', inline: true },
        ]

        const foursFields = [
            { name: 'Base', value: checkRole('Base', info), inline: true },
            { name: 'Outside', value: checkRole('Outside', info), inline: true },
            { name: 'Elf', value: checkRole('Elf', info), inline: true },
            { name: 'Elf', value: '`Empty`', inline: true },
        ]

        const getTeamsizeFields = () => {
            if (info.teamSize === 'Duo') {
                return duoFields
            } else if (info.teamSize === '4s') {
                return foursFields
            } else {
                return groupFields
            }
        }

        const cardEmbed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || this.client.user?.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png' })
            .setColor(roleInfo?.role.color || colours.lightblue)
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
            > **Trialee**\n
            \`RSN:\` ${info.rsn}
            \`Discord:\` <@${info.id}>
            \`Tag:\` ${roleInfo?.key}\n
            > **Team**
            `)
            .addFields(getTeamsizeFields());

        const channel = await this.client.channels.fetch(channels.trialScheduling) as TextChannel;
        await channel.send(
            { content: this.notifyTrialTeam(info.rank, info.teamSize), embeds: [cardEmbed], components: [info.teamSize === 'Duo' ? duoButtonRow : groupButtonRow, controlPanel] }
        )

        const replyEmbed = new EmbedBuilder()
            .setTitle('Trial notification created!')
            .setColor(colours.discord.green)
            .setDescription(`${roles['trialTeam']} has been notified in <#${channels.trialScheduling}>`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}

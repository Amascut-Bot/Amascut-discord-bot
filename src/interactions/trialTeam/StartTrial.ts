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

    get validBossRolesForTeamSize(): ValidRole {
        return {
            'Duo': ['Base', 'DPS'],
            '3-7': ['Base', 'Elf'],
            '4s': ['Base', 'Elf']
        }
    }

    get regionOptions() {
        const assignOptions: any = {
            'North America (East)': 'NA East',
            'North America (West)': 'NA West',
            'Europe': 'Europe',
            'Oceania': 'Oceania',
        }
        return Object.entries(assignOptions).map(([key, value]) => ({ name: key, value: value as string }));
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('role').setDescription('Trialee preferred role').setRequired(true).setAutocomplete(true))
            .addStringOption((option) => option.setName('region').setDescription('Trial world').addChoices(
                ...this.regionOptions
            ).setRequired(true))
    }

    async autocomplete(interaction: any) {
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name !== 'role') return;

        const info = await this.ticketToolEmbedContent(interaction);
        if (!info || !info.teamSize) {
            return await interaction.respond([]);
        }

        const validRoles = this.validBossRolesForTeamSize[info.teamSize] || [];
        
        const filtered = validRoles
            .filter(role => role.toLowerCase().startsWith(focusedOption.value.toLowerCase()))
            .map(role => ({ name: role, value: role }));

        await interaction.respond(filtered);
    }

    public ticketToolEmbedContent = async (interaction: ChatInputCommandInteraction) => {

        const content: EmbedContent = {
            rsn: '',
            id: '',
            teamSize: '',
            rank: '',
            preferredRole: ''
        }

        const cleanValueFromDescription = (description: string, pattern: RegExp, key: string) => {
            const match = description.match(pattern);
            if (match && match[1]) {
                content[key] = match[1].trim();
            }
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
            cleanValueFromDescription(description, /\*{2}RSN\*{2}\n```([\s\S]+?)```/, 'rsn');
            // Discord ID
            cleanValueFromDescription(description, /\*{2}Discord ID\*{2}\n```([\s\S]+?)```/, 'id');
            // Team Size
            cleanValueFromDescription(description, /\*{2}Team Size\*{2}\n```([\s\S]+?)```/, 'teamSize');
            // Rank
            cleanValueFromDescription(description, /\*{2}Rank\*{2}\n```([\s\S]+?)```/, 'rank');
            // Preferred Role
            cleanValueFromDescription(description, /\*{2}Preferred Role\*{2}\n```([\s\S]+?)```/, 'preferredRole');
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
        if (teamSize === '4s') {
            if (rank === 'Grandmaster') {
                key = 'threeSevenGrandmaster';
            } else {
                key = 'fours';
            }
        }
        if (!this.client.util.roles[key]) return;
        const roleObject = await interaction.guild?.roles.fetch(this.client.util.stripRole(this.client.util.roles[key]));
        if (!roleObject) return;
        return {
            key: this.client.util.roles[key],
            role: roleObject
        };
    }

    public getTeamsizeFields = (info: EmbedContent, role: string) => {
        const trialee = `<@${info.id}> (Trialee)`;
        let fields = [];

        if (info.teamSize === 'Duo') {
            fields = [
                { name: 'Base', value: '`Empty`', inline: true },
                { name: 'DPS', value: '`Empty`', inline: true }
            ];
        } else { // 3-7 & 4s
            fields = [
                { name: 'Base', value: '`Empty`', inline: true },
                { name: 'Elf', value: '`Empty`', inline: true },
                { name: 'Elf', value: '`Empty`', inline: true },
                { name: 'Outside', value: '`Empty`', inline: true },
                { name: 'Outside', value: '`Empty`', inline: true },
            ];
        }

        // Place the trialee
        let placed = false;
        for (const field of fields) {
            if (field.name === role && !placed) {
                field.value = trialee;
                placed = true;
            }
        }
        return fields;
    }

    public notifyTrialTeam = (rank: string, teamSize: string): string => {
        if (['4s', '3-7'].includes(teamSize)) {
            if (rank === 'Grandmaster') {
                return this.client.util.roles.notifyGM;
            } else if (rank === 'Master') {
                return this.client.util.roles.notifyMaster;
            } else if (rank === 'Experienced') {
                return this.client.util.roles.notifyExperienced;
            } else if (teamSize === '4s') {
                return this.client.util.roles.notify4s;
            } else {
                return '';
            }
        } else {
            return '';
        }
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const role: string = interaction.options.getString('role', true);
        const region: string = interaction.options.getString('region', true);

        const { roles, colours, channels } = this.client.util;

        const info = await this.ticketToolEmbedContent(interaction);

        let errorMessage = '';

        if (!info) {
            errorMessage += 'There was an issue with grabbing **Ticket Tool** data. Please check if the message is pinned.'
        }

        const errorEmbed = new EmbedBuilder()
            .setTitle('Something went wrong!')
            .setColor(colours.discord.red)
            .setDescription(errorMessage || 'No error message.');
        if (!info) return await interaction.editReply({ embeds: [errorEmbed] });

        if (!this.validBossRolesForTeamSize[info.teamSize] || !this.validBossRolesForTeamSize[info.teamSize].includes(role)) {
            errorEmbed.setDescription(`**${role}** is not a valid role for this team size.`)
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const roleInfo = await this.getTrialledRole(interaction, info.teamSize, info.rank);

        if (!roleInfo || !roleInfo.role) {
            errorEmbed.setDescription(`Could not find a valid trialled role for this user. Their rank of **${info.rank}** may not be applicable for **${info.teamSize}** trials, or the role may be misconfigured.`);
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

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

        const cardEmbed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || this.client.user?.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png' })
            .setColor(roleInfo.role.color || colours.tan)
            .setDescription(`
            > **General**
            \`Host:\` <@${interaction.user.id}>
            \`Time:\` \`ASAP\`
            \`Region:\` ${region}
            \`Ticket:\` <#${interaction.channel?.id}>

            > **Trialee**
            \`RSN:\` ${info.rsn}
            \`Discord:\` <@${info.id}>
            \`Tag:\` ${roleInfo.key}

            > **Team**
            `)
            .addFields(this.getTeamsizeFields(info, role));

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

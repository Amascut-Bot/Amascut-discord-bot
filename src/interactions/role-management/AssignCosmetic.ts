import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, User, Role, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AutocompleteInteraction, Message, MessageFlags } from 'discord.js';

interface Hierarchy {
    [key: string]: string[];
}

interface RemoveHierarchy {
    [key: string]: string[];
}
export default class Pass extends BotInteraction {
    get name() {
        return 'assign-cosmetic';
    }

    get description() {
        return 'Assigns a Cosmetic role to a user';
    }

    get permissions() {
        return 'ADMIN_TRIAL_TEAM';
    }

    get hierarchy(): Hierarchy {
        return {
            killCount: ['']
        }
    }

    get removeHierarchy(): RemoveHierarchy {
        return {
            //'role': ['lower roles']
        }
    }

    get options(): { name: string, value: string }[] {
        const assignOptions: any = {
            '500% Enrage': 'enr500',
            '1000% Enrage': 'enr1000',
            '2000% Enrage': 'enr2000',
            '4000% Enrage': 'enr4000',
            'the Lightbearer (Release week 2000%)': 'rw2000',
            'Cat-Bound Initiate (100KC)': 'kc100',
            'Scarab-Marked Disciple (250KC)': 'kc250',
            'Whisperer of the Wanderer (500KC)': 'kc500',
            'Bearer of the Unholy Sigil (750KC)': 'kc750',
            'Fang of the Devourer (1000KC)': 'kc1000',
            'Seeker of the Kharid-ib (1500KC)': 'kc1500',
            'Echo of Mah\'s Madness (2000KC)': 'kc2000',
            'Oracle of the Hollow Sun (3000KC)': 'kc3000',
            'Herald of the Scarab Paraoh (5000KC)': 'kc5000',
            'Soul-Eater Ascendant (7500KC)': 'kc7500',
            'Eternal Fang of the Devourer (10000KC)': 'kc10000',
            'Visionmaker (Full Log)': 'visionmaker',
            'Tumeken mask (5)': 'mask5',
            'Tumeken robe top (5)': 'top5',
            'Tumeken robe bottom (5)': 'bottom5',
            'Tumeken gloves (5)': 'gloves5',
            'Tumeken boots (5)': 'boots5',
            'Devourers guard (5)': 'guard5',
            'Tumekenslight (5)': 'light5',
            'Amaskitty': 'pet',
            'Nexus (5)': 'nexus5',
            'The Devoured (Unorthodox CA)': 'devoured',
            'Tumeken\'s Light (Perfect CA)': 'tumekensLight',
            'Kharidian Speedster': 'kspeedster',
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
            .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
            .addStringOption((option) => option.setName('role').setDescription('Role').setAutocomplete(true).setRequired(true))
    }

    async autocomplete(interaction: AutocompleteInteraction): Promise<any> {
        const focusedValue = interaction.options.getFocused();
        const filtered = this.options.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const userResponse: User = interaction.options.getUser('user', true);
        const role: string = interaction.options.getString('role', true);

        const { colours, categorizeChannel, categorize } = this.client.util;

        const outputChannelId = categorizeChannel(role) ? this.client.channelIds[categorizeChannel(role)] : '';
        let channel;
        if (outputChannelId) {
            channel = await this.client.channels.fetch(outputChannelId) as TextChannel;
        }

        const user = await interaction.guild?.members.fetch(userResponse.id);
        const userRoles = await user?.roles.cache.map(role => role.id) || [];
        const addedRoleIds: string[] = [];
        const removedRoleIds: string[] = [];
        const addedRoleMentions: string[] = [];
        const removedRoleMentions: string[] = [];

        let sendMessage = false;
        const roleObject = await interaction.guild?.roles.fetch(this.client.roleIds[role]) as Role;
        let embedColour = colours.discord.green;

        const hasHigherRole = (role: string) => {
            try {
                if (!categorize(role)) return false;
                const categorizedHierarchy = this.hierarchy[categorize(role)];
                if (!categorizedHierarchy) return false;
                const sliceFromIndex: number = categorizedHierarchy.indexOf(role) + 1;
                const hierarchyList = categorizedHierarchy.slice(sliceFromIndex);
                const hierarchyIdList = hierarchyList.map((item: string) => this.client.roleIds[item]);
                const intersection = hierarchyIdList.filter((roleId: string) => userRoles.includes(roleId));
                if (intersection.length === 0) {
                    return false
                } else {
                    return true
                };
            }
            catch (err) { return false }
        }

        const roleId = this.client.roleIds[role];
        if (!hasHigherRole(role)) {
            if (!userRoles?.includes(roleId)) {
                await user?.roles.add(roleId);
                addedRoleIds.push(roleId);
                addedRoleMentions.push(this.client.roles[role]);
            }
        }
        embedColour = roleObject.colors.primaryColor ?? this.client.color;
        if (addedRoleIds.includes(roleId)) {
            sendMessage = true;
        }
        if (role in this.removeHierarchy) {
            for await (const roleToRemove of this.removeHierarchy[role]) {
                const removeRoleId = this.client.roleIds[roleToRemove];
                if (userRoles?.includes(removeRoleId)) {
                    await user?.roles.remove(removeRoleId);
                    removedRoleIds.push(removeRoleId);
                    removedRoleMentions.push(this.client.roles[roleToRemove]);
                }
            };
        }

        const hasRoleChanges = addedRoleIds.length > 0 || removedRoleIds.length > 0;

        let returnedMessage = {
            id: '',
            url: ''
        };

        let confirmationMessage: Message | null = null;

        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() || this.client.user?.avatarURL() || 'https://media.discordapp.net/attachments/1027186342620299315/1047598720834875422/618px-Solly_pet_1.png' })
            .setTimestamp()
            .setColor(embedColour)
            .setDescription(`Congratulations to <@${userResponse.id}> on achieving ${this.client.roles[role]}!`);

        if (sendMessage && channel) {
            const message = await channel.send({ embeds: [embed] });
            confirmationMessage = message;
            returnedMessage.id = message.id;
            returnedMessage.url = message.url;

            // deactivate automatic reacts for now
            /*
            const emojis = ['Pog', 'gz'];

            for (let index = 0; index < emojis.length; index++) {
                const emoji = this.client.emojiCache.get(emojis[index]);

                if (emoji) {
                    message.react(emoji);
                }
            }
            */
        }

        const logChannel = await this.client.channels.fetch(this.client.channelIds.roleAssignLogs) as TextChannel;
        if (hasRoleChanges) {
            const roleAssignmentLog = await this.client.util.createRoleAssignmentLog({
                targetUserId: userResponse.id,
                actorUserId: interaction.user.id,
                source: 'assign-cosmetic',
                addedRoleIds,
                removedRoleIds,
                announcementChannelId: confirmationMessage?.channelId ?? null,
                announcementMessageId: confirmationMessage?.id ?? null
            });

            const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(this.client.util.getRejectRoleAssignCustomId(roleAssignmentLog.id))
                        .setLabel('Reject Approval')
                        .setStyle(ButtonStyle.Danger),
                );

            const changeLines: string[] = [];

            if (addedRoleMentions.length > 0) {
                changeLines.push(`${addedRoleMentions.join(', ')} was assigned to <@${userResponse.id}> by <@${interaction.user.id}>.`);
            }

            if (removedRoleMentions.length > 0) {
                changeLines.push(`${removedRoleMentions.join(', ')} was removed from <@${userResponse.id}>.`);
            }

            if (returnedMessage.url) {
                changeLines.push(`**Message**: ${returnedMessage.url}`);
            }

            const logEmbed = new EmbedBuilder()
                .setTimestamp()
                .setColor(embedColour)
                .setDescription(changeLines.join('\n'));

            await logChannel.send({ embeds: [logEmbed], components: [buttonRow] });
        }

        const replyEmbed = new EmbedBuilder()
            .setTitle(hasRoleChanges ? 'Role successfully updated!' : 'Role assign failed.')
            .setColor(hasRoleChanges ? colours.discord.green : colours.discord.red)
            .setDescription(hasRoleChanges ? `
            **Member:** <@${userResponse.id}>
            ${addedRoleMentions.length > 0 ? `**Assigned Roles:** ${addedRoleMentions.join(', ')}
            ` : ''}${removedRoleMentions.length > 0 ? `**Removed Roles:** ${removedRoleMentions.join(', ')}
            ` : ''}` : `This user either has this role, or a higher level role.`);
        await interaction.editReply({ embeds: [replyEmbed] });
    }
}

import { Warning } from '../../entity/Warning';
import BotInteraction from '../../types/BotInteraction';
import { ChannelType, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, TextChannel, User } from 'discord.js';

export default class Warn extends BotInteraction {
    get name() {
        return 'warn';
    }

    get description() {
        return 'Manage a User\'s warnings';
    }

    get permissions() {
        return 'ADMIN';
    }

    get actionOptions() {
        const ticketTypes: Record<string, number> = {
            'Add': 0,
            'Remove': 1,
            'List': 2,
            'Update': 3
        }
        const options: { name: string, value: number }[] = [];
        Object.keys(ticketTypes).forEach((key: string) => {
            options.push({ name: key, value: ticketTypes[key] })
        })
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addNumberOption((option) => option.setName('action').setDescription('Action').addChoices([...this.actionOptions]).setRequired(true))
            .addUserOption((option) => option.setName('user').setDescription('User').setRequired(false))
            .addStringOption((option) => option.setName('reason').setDescription('Reason of the warning').setRequired(false))
            .addChannelOption((option) => option.setName('reportref').setDescription('Any ticket reference').setRequired(false).addChannelTypes(ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.GuildText))
            .addNumberOption((option) => option.setName('id').setDescription('Id of the warning (when removing)').setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        const adminChannelId = this.client.channelIds.ADMIN_CHANNEL;

        if (interaction.channel?.id === adminChannelId) {
            await interaction.deferReply();
        } else {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }


        const action: number = interaction.options.getNumber('action', true);
        const user: User | null = interaction.options.getUser('user', false);
        const reason: string | null = interaction.options.getString('reason', false);
        const reportRef: TextChannel | null = interaction.options.getChannel('reportref', false);
        const id: number | null = interaction.options.getNumber('id', false);

        const { dataSource } = this.client;
        const repository = dataSource.getRepository(Warning);
        if (reportRef !== null && reportRef?.parentId !== this.client.channelIds.TICKET_TRANSCRIPT_CHANNEL && reportRef?.parentId !== this.client.channelIds.ticketCategory && reportRef?.parentId !== this.client.channelIds.wipTicketCategory) {
            const response = this.client.cv2.getContainerBuilder(false, this.name)
                .addTextDisplayComponents(builder => builder.setContent('You can only use the report reference option in the ticket channel!'));
            return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2 });
        }
        switch (action) {
            case 0:
                // Add warning
                if (user && reason) {
                    const warningData: Partial<Warning> = {
                        user: user.id,
                        reason: reason,
                        issuedBy: interaction.user.id,
                    };
                    if (reportRef) warningData.reportRef = reportRef.id;

                    const newWarning: Warning = repository.create(warningData);

                    const savedWarning: Warning = await repository.save(newWarning);

                    const response = this.client.cv2.getContainerBuilder(true, 'Add warning')
                        .addTextDisplayComponents(builder => builder.setContent(`### Warned <@${user.id}>:\n**Reason:** \`${reason}\`\n**Issued by:** <@${interaction.user.id}>\n**Warning ID**: \`${savedWarning.id}\``));
                    return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });
                } else {
                    const response = this.client.cv2.getContainerBuilder(false, 'Add warning')
                        .addTextDisplayComponents(builder => builder.setContent('You have to provide an User and a Reason to warn someone!'));
                    return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2 });
                }

            case 1:
                // Remove warning
                if (id) {
                    const foundWarning: Warning | null = await repository.findOne({
                        where: {
                            id: id
                        }
                    });

                    if (foundWarning) {
                        await repository.remove(foundWarning);

                        const response = this.client.cv2.getContainerBuilder(true, 'Remove warning')
                            .addTextDisplayComponents(builder => builder.setContent(`Successfully removed warning with ID \`${id}\` from User <@${foundWarning.user}>\nThe reason of the warning was: \`${foundWarning.reason}\``));
                        return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });
                    } else {
                        const response = this.client.cv2.getContainerBuilder(false, 'Remove warning')
                            .addTextDisplayComponents(builder => builder.setContent(`Could not find a warning with ID \`${id}\``));
                        return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2 });
                    }
                } else {
                    const response = this.client.cv2.getContainerBuilder(false, 'Remove warning')
                        .addTextDisplayComponents(builder => builder.setContent('You have to provide an ID to delete a warning!'));
                    return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2 });
                }

            case 2:
                // List warnings
                let foundWarnings: Warning[] | null = await repository.find({
                    order: {
                        createdAt: 'ASC'
                    }
                });
                let filters: string = '';

                if (id) {
                    foundWarnings = foundWarnings.filter(x => x.id === id);
                    filters += `\n- **ID:** \`${id}\``;
                }

                if (user) {
                    foundWarnings = foundWarnings.filter(x => x.user === user.id);
                    filters += `\n- **User:** <@${user.id}>`;
                }

                if (reportRef) {
                    foundWarnings = foundWarnings.filter(x => x.reportRef === reportRef.id);
                    filters += `\n- **Report reference:** \`${reportRef}\``;
                }

                if (foundWarnings.length > 0 && foundWarnings.length < 25) {
                    const response = this.client.cv2.getContainerBuilder(null, `List warnings - \`${foundWarnings.length}\` found`);

                    let content: string = '';

                    if (id) {
                        content = `Found warning for ID \`${id}\`:\n\n`
                    } else if (user) {
                        content = `Found warnings for User <@${user.id}>:\n\n`
                    } else if (reportRef) {
                        content = `Found warnings for report reference \`${reportRef}\`:\n\n`
                    } else {
                        content = `Found warnings:\n\n`
                    }

                    for (const warning of foundWarnings) {
                        if (id) {
                            content += `**User:** <@${warning.user}>\n`
                            content += `**Reason:** \`${warning.reason}\`\n`;
                            if (warning.reportRef) content += `**Report reference:** <#${warning.reportRef}>\n`;
                        } else if (user) {
                            content += `**ID:** \`${warning.id}\`\n`;
                            content += `**Reason:** \`${warning.reason}\`\n`;
                            if (warning.reportRef) content += `**Report reference:** <#${warning.reportRef}>\n`;
                        } else {
                            content += `**ID:** \`${warning.id}\`\n`;
                            content += `**User:** <@${warning.user}>\n`;
                            content += `**Reason:** \`${warning.reason}\`\n`;
                            if (warning.reportRef) content += `**Report reference:** <#${warning.reportRef}>\n`;
                        }
                        content += '\n';
                    }

                    content = content.trim();

                    response.addTextDisplayComponents(builder => builder.setContent(content));

                    return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });
                } else if (foundWarnings.length >= 25) {
                    const response = this.client.cv2.getContainerBuilder(false, 'List warnings')
                        .addTextDisplayComponents(builder => builder.setContent(`Found too many warnings (\`${foundWarnings.length}\`), please specify your search until a proper pagination system is implemented.`));
                    return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2 });
                } else {
                    const response = this.client.cv2.getContainerBuilder(false, 'List warnings')
                        .addTextDisplayComponents(builder => builder.setContent(`Could not find any warnings for the specified filters:${filters.length > 0 ? filters : '\n- No filters provided'}`));
                    return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2 });
                }

            case 3:
                if (id) {
                    const foundWarning: Warning | null = await repository.findOne({
                        where: {
                            id: id
                        }
                    });

                    if (foundWarning) {
                        if (user) foundWarning.user = user.id;
                        if (reportRef) foundWarning.reportRef = reportRef.id;
                        if (reason) foundWarning.reason = reason;

                        await repository.save(foundWarning);

                        const response = this.client.cv2.getContainerBuilder(true, 'Update warning')
                            .addTextDisplayComponents(builder => builder.setContent(`Successfully updated warning with ID \`${id}\` from User <@${foundWarning.user}>\n**Reason:** \`${foundWarning.reason}\`${reportRef ? `\n**Report reference:** <#${reportRef.id}>` : ''}`));
                        return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });
                    } else {
                        const response = this.client.cv2.getContainerBuilder(false, 'Update warning')
                            .addTextDisplayComponents(builder => builder.setContent(`Could not find a warning with ID \`${id}\``));
                        return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2 });
                    }
                } else {
                    const response = this.client.cv2.getContainerBuilder(false, 'Update warning')
                        .addTextDisplayComponents(builder => builder.setContent('You have to provide an ID to update a warning!'));
                    return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2 });
                }
            default:
                break;
        }

        const response = this.client.cv2.getContainerBuilder(false, this.name)
            .addTextDisplayComponents(builder => builder.setContent(`Unknown Action`));
        return await interaction.editReply({ components: [response], flags: MessageFlags.IsComponentsV2 });
    }
}

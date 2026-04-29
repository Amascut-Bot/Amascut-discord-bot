import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, FileUploadBuilder, Interaction, Message, MessageFlags, ModalBuilder, ModalSubmitInteraction, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from 'discord.js';
import Bot from '../Bot';
import { TrialReport } from '../entity/TrialReport';
import { ReportBlacklist } from '../entity/ReportBlacklist';

export default class reportHandler {
    static readonly REQUIRED_REPORTS = 3;
    static readonly APPROVAL_THRESHOLD = 5;
    static readonly REJECTION_THRESHOLD = 5;

    client: Bot;
    id: string;
    interaction: Interaction;

        constructor(client: Bot, id: string, interaction: Interaction) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;

        if (id === 'report_submit' && interaction.isChatInputCommand()) {
            this.showReportModal(interaction as ChatInputCommandInteraction<'cached'>);
            return;
        }

        if (id.startsWith('report_submitModal') && interaction.isModalSubmit()) {
            this.handleReportSubmit(interaction as ModalSubmitInteraction);
            return;
        }

        // Direct approve - save to DB + check for 3+ reports
        if (id === 'report_approve' && interaction.isButton()) {
            this.approveReport(interaction as ButtonInteraction<'cached'>);
            return;
        }

        // Direct reject - just update embed
        if (id === 'report_reject' && interaction.isButton()) {
            this.rejectReport(interaction as ButtonInteraction<'cached'>);
            return;
        }

        if (id === 'checkreports_submit' && interaction.isChatInputCommand()) {
        this.showCheckReportsModal(interaction as ChatInputCommandInteraction<'cached'>);
        return;
        }

        if (id.startsWith('checkreportsModal') && interaction.isModalSubmit()) {
        this.handleCheckReports(interaction as ModalSubmitInteraction);
        return;
        }
    }

    private async showReportModal(interaction: ChatInputCommandInteraction<'cached'>) {
        const modal = new ModalBuilder()
            .setCustomId(`report_submitModal_${interaction.user.id}`)
            .setTitle('Report a user');

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('report_user')
            .setRequired(true)
            .setMaxValues(1);

        modal.addLabelComponents(label => label
            .setLabel('User reported')
            .setUserSelectMenuComponent(userSelect)
        );

        const rsnInput = new TextInputBuilder()
            .setCustomId('report_rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('Reported user\'s RSN')
            .setTextInputComponent(rsnInput)
        );

        const roleSelect = new StringSelectMenuBuilder()
            .setCustomId('report_role')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Elite 500').setValue('elite500'),
                new StringSelectMenuOptionBuilder().setLabel('Elite 1000').setValue('elite1000'),
                new StringSelectMenuOptionBuilder().setLabel('Elite 2000').setValue('elite2000'),
                new StringSelectMenuOptionBuilder().setLabel('Master 1000').setValue('master1000'),
                new StringSelectMenuOptionBuilder().setLabel('Master 2000').setValue('master2000'),                
            ])
            .setMaxValues(1);

        modal.addLabelComponents(label => label
            .setLabel('What role are you reporting them for?')
            .setStringSelectMenuComponent(roleSelect)
        );


        const descriptionInput = new TextInputBuilder()
            .setCustomId('report_description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000);

        modal.addLabelComponents(label => label
            .setLabel('Why you are reporting this user')
            .setTextInputComponent(descriptionInput)
        );

        const fileUpload = new FileUploadBuilder()
            .setCustomId('attachment')
            .setRequired(false)
            .setMaxValues(1);

        modal.addLabelComponents(label => label
            .setLabel('File')
            .setFileUploadComponent(fileUpload)
        );

        await interaction.showModal(modal);
    }

   private async handleReportSubmit(interaction: ModalSubmitInteraction) {
    if (!interaction.inCachedGuild()) return;

    const modalUserId = interaction.customId.split('_')[2];
    if (modalUserId !== interaction.user.id) {
        return await interaction.editReply('This modal is not for you.');
    }

    try {
        const selectedUsers = interaction.fields.getSelectedUsers('report_user');
        const roleKey = interaction.fields.getStringSelectValues('report_role')[0];
        const rsn = interaction.fields.getTextInputValue('report_rsn').trim();
        const description = interaction.fields.getTextInputValue('report_description').trim();

        if (!selectedUsers?.size) {
            return await interaction.editReply({ content: 'Please select a user to report.' });
        }

        const targetUser = selectedUsers.first()!;

        // Check blacklist
        let isBlacklisted = false;
        try {
            const blacklistEntry = await this.client.dataSource.getRepository(ReportBlacklist)
                .findOne({ where: { userId: interaction.user.id } });
            isBlacklisted = !!blacklistEntry;
        } catch (blacklistError) {
            this.client.logger.error({ message: 'Failed to check blacklist', error: blacklistError, handler: this.constructor.name });
            return await interaction.editReply('Something went wrong. Please try again.').catch(() => { });
        }

        if (isBlacklisted) {
            return await interaction.reply({ content: 'You are blacklisted from reporting.', flags: MessageFlags.Ephemeral });
        }


        // Role check
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const userRoleIds = member.roles.cache.map(r => r.id);
        const rolePriority = this.client.util.getTrialTierPriority(roleKey);

        if (rolePriority === null) {
            return await interaction.reply({ content: 'Invalid role selected.', flags: MessageFlags.Ephemeral });
        }

        if (!this.client.util.canVouchForTrialRole(userRoleIds, roleKey)) {
            return await interaction.reply({ 
                content: `You must have ${this.client.roles[roleKey]} or higher to report for this role.`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        // Check reported user has the role they're being reported for
        const reportedMember = await interaction.guild.members.fetch(targetUser.id);
        const reportedUserRoleIds = reportedMember.roles.cache.map(r => r.id);

        if (!this.client.util.canVouchForTrialRole(reportedUserRoleIds, roleKey)) {
            return await interaction.reply({ 
                content: `The user you're reporting must have ${this.client.roles[roleKey]} role to be reported.`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        // Send to channel - DON'T SAVE TO DB YET
        const reportChannel = await this.client.channels.fetch(this.client.channelIds.reportLogs) as TextChannel;
        
        if (!reportChannel) {
            return await interaction.editReply('Error: Report channel not found.');
        }

        const embed = new EmbedBuilder()
            .setTitle('Report - Approval Required')
            .setColor(this.client.color)
            .addFields(
                { name: 'Reported User', value: `<@${targetUser.id}>`, inline: true },
                { name: 'Role', value: this.client.roles[roleKey], inline: true },
                { name: 'RSN', value: rsn, inline: true },
                { name: 'Reporter', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Description', value: description, inline: false }
            )
            .setTimestamp();

        const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('report_approve')
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('report_reject')
                .setLabel('Reject')
                .setStyle(ButtonStyle.Danger)
        );

        await reportChannel.send({ embeds: [embed], components: [voteRow] });

        await interaction.reply({ 
            content: `Report submitted for <@${targetUser.id}> - ${this.client.roles[roleKey]}`, 
            flags: MessageFlags.Ephemeral 
        });
    } catch (error) {
        this.client.logger.error({ message: 'Failed to handle report submission', error, handler: this.constructor.name });
        await interaction.editReply('Something went wrong. Please try again.').catch(() => { });
    }
}

private async approveReport(interaction: ButtonInteraction<'cached'>) {
    if (!await this.client.util.hasRolePermissions(this.client, ['reportPerms', 'admin', 'owner'], interaction)) {
        return await interaction.reply({
            content: 'You don\'t have permission to approve reports.',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferUpdate();

    try {
        const embed = interaction.message.embeds[0];
        
        // Use embed.data.fields instead of embed.fields
        const fields = embed.data?.fields || [];
        
        const reportedUserField = fields.find(f => f.name === 'Reported User');
        const roleField = fields.find(f => f.name === 'Role');
        const rsnField = fields.find(f => f.name === 'RSN');
        const reporterField = fields.find(f => f.name === 'Reporter');
        const descriptionField = fields.find(f => f.name === 'Description');

        const reportedUserId = reportedUserField?.value.replace(/<@|>/g, '') || '';
        const reporterId = reporterField?.value.replace(/<@|>/g, '') || '';
        const rsn = rsnField?.value || '';
        const description = descriptionField?.value || '';
        
        // Get role key from role name
        const roleName = roleField?.value || '';
        const roleKey = Object.entries(this.client.roles).find(([_, name]) => name === roleName)?.[0] || '';

        if (!reportedUserId || !roleKey) {
            this.client.logger.error({ 
                message: 'Missing required data from embed', 
                error: new Error('Missing data'),
                handler: this.constructor.name 
            });
            return await interaction.followUp({ content: 'Error: Could not parse report data.', flags: MessageFlags.Ephemeral });
        }

        // Save to DB
        const reportRepository = this.client.dataSource.getRepository(TrialReport);
        const report = reportRepository.create({
            reporter: reporterId,
            reportedUser: reportedUserId,
            rsn: rsn,
            role: roleKey,
            description: description,
            status: 'approved',
            ticketChannelId: interaction.channel!.id
        });
        await reportRepository.save(report);

        // Check if user has 3+ approved reports
        const allApprovedReports = await reportRepository.find({
            where: { reportedUser: reportedUserId, role: roleKey, status: 'approved' }
        });

        if (allApprovedReports.length >= reportHandler.REQUIRED_REPORTS) {
            // Remove the role from the reported user
            try {
                const reportedMember = await interaction.guild?.members.fetch(reportedUserId);
                if (reportedMember) {
                    const roleIdToRemove = this.client.roleIds[roleKey];
                    if (roleIdToRemove) {
                        const downgradeMap: Record<string, string> = {
                            master2000: 'elite2000', //Map reported roles to downgraded roles
                            master1000: 'elite1000',
                        };
                        const notifyMap: Record<string, string> = { //Map notify roles to reported role to remove if approved
                            master2000: 'notifyMaster2000',
                            master1000: 'notifyMaster1000',
                            elite2000: 'notifyElite2000',
                            elite1000: 'notifyElite1000',
                            elite500: 'notifyElite500',
                        };

                        await reportedMember.roles.remove(roleIdToRemove);

                        const notifyKey = notifyMap[roleKey];
                        if (notifyKey && this.client.roleIds[notifyKey]) {
                            await reportedMember.roles.remove(this.client.roleIds[notifyKey]).catch(() => { });
                        }

                        const masterSubRoles = ['master2000', 'master1000']; //Roles that provide the "Master" umbrella role
                        const eliteSubRoles = ['elite2000', 'elite1000', 'elite500']; //Roles that provide the "Elite" umbrella role

                        const role = interaction.guild?.roles.cache.get(this.client.roleIds[roleKey]);

                        const downgradeKey = downgradeMap[roleKey];
                        const downgradeRole = interaction.guild?.roles.cache.get(this.client.roleIds[downgradeKey]);


                        if (downgradeKey && this.client.roleIds[downgradeKey]) {
                            await reportedMember.roles.add(this.client.roleIds[downgradeKey]).catch(() => { });
                            await reportedMember.send(
                                `You have had the ${[role?.name ?? roleKey]} role removed due to multiple approved reports against you and have been downgraded to ${[downgradeRole?.name ?? downgradeKey]}. You will need to retrial to obtain the role again.`
                            ).catch(() => { });
                        } else {
                            await reportedMember.send(
                                `You have had the ${[role?.name ?? roleKey]} role removed due to multiple approved reports against you. You will need to retrial to obtain the role again.`
                            ).catch(() => { });
                        }

                        // Re-fetch to get up-to-date role list after all additions/removals
                        const updatedMember = await interaction.guild?.members.fetch(reportedUserId);
                        const updatedRoleIds = updatedMember?.roles.cache.map(r => r.id) ?? [];

                        if (masterSubRoles.includes(roleKey)) {
                            const stillHasMaster = masterSubRoles.some(k => updatedRoleIds.includes(this.client.roleIds[k]));
                            if (!stillHasMaster && this.client.roleIds.master) {
                                await updatedMember?.roles.remove(this.client.roleIds.master).catch(() => { });
                            }
                        } else if (eliteSubRoles.includes(roleKey)) {
                            const stillHasElite = eliteSubRoles.some(k => updatedRoleIds.includes(this.client.roleIds[k]));
                            if (!stillHasElite && this.client.roleIds.elite) {
                                await updatedMember?.roles.remove(this.client.roleIds.elite).catch(() => { });
                            }
                        }

                        // If downgraded into elite tier, ensure elite umbrella role is given
                        if (downgradeKey && eliteSubRoles.includes(downgradeKey) && this.client.roleIds.elite) {
                            await updatedMember?.roles.add(this.client.roleIds.elite).catch(() => { });
                        }

                        const logChannel = this.client.channelIds.roleAssignLogs
                            ? await this.client.channels.fetch(this.client.channelIds.roleAssignLogs) as TextChannel : null;

                        if (logChannel) {
                            const logDescription = downgradeKey
                                ? `Role ${this.client.roles[roleKey]} has been removed from <@${reportedUserId}> due to 3 approved reports. They have been downgraded to ${this.client.roles[downgradeKey]}.`
                                : `Role ${this.client.roles[roleKey]} has been removed from <@${reportedUserId}> due to 3 approved reports.`;
                            await logChannel.send({
                                embeds: [new EmbedBuilder()
                                    .setColor(0xff0000)
                                    .setDescription(logDescription)
                                    .setTimestamp()]
                            });
                        }
                    }
                }
                // Reset report count by deleting all approved reports for this user+role combo
                const reportsToReset = await reportRepository.find({
                    where: { 
                        reportedUser: reportedUserId, 
                        role: roleKey,
                        status: 'approved' 
                    }
                });

                if (reportsToReset.length > 0) {
                    for (const report of reportsToReset) {
                        report.status = 'role_removed';
                    };
                    await reportRepository.save(reportsToReset);
                    console.log(`[ReportHandler] Reset report count for user ${reportedUserId} (role: ${roleKey})`);
                }
            } catch (roleError) {
                this.client.logger.error({ message: 'Failed to remove role', error: roleError, handler: this.constructor.name });
            }
        }

        // Update embed
        await interaction.message.edit({
            embeds: [EmbedBuilder.from(embed)
                .setColor(0x00ff00)
                .setTitle('Report - APPROVED')],
            components: []
        });

        await interaction.followUp({ content: `Report approved! (${allApprovedReports.length}/${reportHandler.REQUIRED_REPORTS})`, flags: MessageFlags.Ephemeral });
    } catch (error) {
        this.client.logger.error({ message: 'Failed to approve report', error, handler: this.constructor.name });
        await interaction.followUp({ content: 'Error approving report.', flags: MessageFlags.Ephemeral });
    }
}

private async rejectReport(interaction: ButtonInteraction<'cached'>) {
    if (!await this.client.util.hasRolePermissions(this.client, ['admin', 'owner'], interaction)) {
        return await interaction.reply({
            content: 'Only admin/owner can reject.',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferUpdate();

    try {
        const embed = interaction.message.embeds[0];

        // Just update embed - NO DB SAVE
        await interaction.message.edit({
            embeds: [EmbedBuilder.from(embed)
                .setColor(0xff0000)
                .setTitle('Report - REJECTED')],
            components: []
        });

        await interaction.followUp({ content: 'Report rejected.', flags: MessageFlags.Ephemeral });
    } catch (error) {
        this.client.logger.error({ message: 'Failed to reject report', error, handler: this.constructor.name });
    }
}

private async showCheckReportsModal(interaction: ChatInputCommandInteraction<'cached'>) {
    const modal = new ModalBuilder()
        .setCustomId(`checkreportsModal_${interaction.user.id}`)
        .setTitle('Check Reports');

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('checkreports_user')
        .setRequired(true)
        .setMaxValues(1);

    modal.addLabelComponents(label => label
        .setLabel('User to check')
        .setUserSelectMenuComponent(userSelect)
    );

    const roleSelect = new StringSelectMenuBuilder()
        .setCustomId('checkreports_role')
        .addOptions([
            new StringSelectMenuOptionBuilder().setLabel('Elite 500').setValue('elite500'),
            new StringSelectMenuOptionBuilder().setLabel('Elite 1000').setValue('elite1000'),
            new StringSelectMenuOptionBuilder().setLabel('Elite 2000').setValue('elite2000'),
            new StringSelectMenuOptionBuilder().setLabel('Master 1000').setValue('master1000'),
            new StringSelectMenuOptionBuilder().setLabel('Master 2000').setValue('master2000'),                
        ])
        .setMaxValues(1);

    modal.addLabelComponents(label => label
        .setLabel('Select role to check')
        .setStringSelectMenuComponent(roleSelect)
    );

    await interaction.showModal(modal);
}

private async handleCheckReports(interaction: ModalSubmitInteraction) {
    if (!interaction.inCachedGuild()) return;

    const modalUserId = interaction.customId.split('_')[1];
    if (modalUserId !== interaction.user.id) {
        return await interaction.reply({ content: 'This modal is not for you.', flags: MessageFlags.Ephemeral });
    }

    try {
        const selectedUsers = interaction.fields.getSelectedUsers('checkreports_user');
        const roleKey = interaction.fields.getStringSelectValues('checkreports_role')[0];

        if (!selectedUsers?.size) {
            return await interaction.reply({ content: 'Please select a user to check.', flags: MessageFlags.Ephemeral });
        }

        const targetUser = selectedUsers.first()!;

        // Get approved reports for this user and role
        const reportRepository = this.client.dataSource.getRepository(TrialReport);
        const reports = await reportRepository.find({
            where: { 
                reportedUser: targetUser.id, 
                role: roleKey,
                status: 'approved'
            }
        });

        const reportCount = reports.length;
        const roleName = this.client.roles[roleKey] || roleKey;

        const embed = new EmbedBuilder()
            .setTitle(`Reports for ${targetUser.displayName}`)
            .setColor(this.client.color)
            .addFields(
                { name: 'User', value: `<@${targetUser.id}>`, inline: true },
                { name: 'Role', value: roleName, inline: true },
                { name: 'Approved Reports', value: `${reportCount}/${reportHandler.REQUIRED_REPORTS}`, inline: true }
            )
            .setTimestamp();

        if (reportCount > 0) {
            const reportList = reports.map(r => 
                `• Reporter: <@${r.reporter}> | Description: ${r.description} | Date: <t:${Math.floor(r.createdAt.getTime() / 1000)}:R>`
            ).join('\n');
            embed.addFields({ name: 'Report History', value: reportList, inline: false });
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
        this.client.logger.error({ message: 'Failed to check reports', error, handler: this.constructor.name });
        await interaction.reply({ content: 'Something went wrong. Please try again.', flags: MessageFlags.Ephemeral });
    }
}
    //#endregion
}

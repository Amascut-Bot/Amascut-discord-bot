import { Collection, Message, Guild, PartialMessage, Attachment } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export default class TranscriptGenerator {

    public static async createTranscript(messages: Collection<string, Message | PartialMessage>, channelName: string): Promise<Buffer> {
        const html = await this.generateHtml(messages, channelName);
        return Buffer.from(html, 'utf-8');
    }

    private static async generateHtml(messages: Collection<string, Message | PartialMessage>, channelName: string): Promise<string> {
        const messageHtml = Array.from(messages.values()).reverse().map(this.formatMessage, this).join('');

        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width">
                    <title>Transcript for #${channelName}</title>
                    <style>
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            background-color: #36393f;
                            color: #dcddde;
                            margin: 0;
                            padding: 20px;
                        }
                        .container {
                            background-color: #2f3136;
                            border-radius: 5px;
                            padding: 20px;
                        }
                        .header {
                            border-bottom: 1px solid #40444b;
                            padding-bottom: 10px;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            color: #ffffff;
                            margin: 0;
                        }
                        .message-group {
                            margin-bottom: 20px;
                            display: flex;
                        }
                        .avatar {
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            margin-right: 15px;
                        }
                        .message-content {
                            flex-grow: 1;
                        }
                        .author-info {
                            display: flex;
                            align-items: center;
                            margin-bottom: 5px;
                        }
                        .author-info .username {
                            font-weight: bold;
                            color: #ffffff;
                            margin-right: 10px;
                        }
                        .author-info .timestamp {
                            font-size: 0.75em;
                            color: #72767d;
                        }
                        .message-text {
                            white-space: pre-wrap;
                            word-wrap: break-word;
                        }
                        .attachment {
                            margin-top: 10px;
                            background-color: #292b2f;
                            border-radius: 3px;
                            padding: 10px;
                            display: inline-block;
                        }
                        .attachment a {
                            color: #00b0f4;
                            text-decoration: none;
                        }
                        .attachment img {
                            max-width: 400px;
                            border-radius: 3px;
                            margin-top: 5px;
                        }
                        .embed {
                            background-color: #292b2f;
                            border-left: 4px solid #4f545c;
                            border-radius: 3px;
                            padding: 10px;
                            margin-top: 10px;
                        }
                        .embed-title {
                            font-weight: bold;
                            color: #ffffff;
                            margin-bottom: 5px;
                        }
                        .embed-description {
                            font-size: 0.9em;
                        }
                        .embed-footer {
                            font-size: 0.75em;
                            color: #72767d;
                            margin-top: 10px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Transcript for #${channelName}</h1>
                        </div>
                        ${messageHtml}
                    </div>
                </body>
            </html>
        `;
    }

    private static formatMessage(message: Message | PartialMessage): string {
        const author = message.author;
        // This can be null for partial messages
        if (!author) {
            return '';
        }

        // Don't render empty messages (e.g. from deleted embeds or other system events)
        if (!message.content && message.attachments.size === 0 && message.embeds.length === 0) {
            return '';
        }

        const avatarUrl = author.displayAvatarURL({ size: 64 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const username = author.username || 'Unknown User';
        const timestamp = message.createdAt.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        let messageBody = message.content ? this.escapeHtml(message.content) : '';

        // Handle attachments
        if (message.attachments.size > 0) {
            message.attachments.forEach(attachment => {
                messageBody += this.formatAttachment(attachment);
            });
        }

        // Handle embeds
        if (message.embeds.length > 0) {
            message.embeds.forEach(embed => {
                messageBody += this.formatEmbed(embed);
            });
        }

        return `
            <div class="message-group">
                <img class="avatar" src="${avatarUrl}" alt="Avatar">
                <div class="message-content">
                    <div class="author-info">
                        <span class="username">${this.escapeHtml(username)}</span>
                        <span class="timestamp">${timestamp}</span>
                    </div>
                    <div class="message-text">${messageBody}</div>
                </div>
            </div>
        `;
    }

    private static formatAttachment(attachment: Attachment): string {
        const isImage = attachment.contentType?.startsWith('image/');
        if (isImage) {
            return `<div class="attachment"><a href="${attachment.url}" target="_blank">${this.escapeHtml(attachment.name || 'attachment')}</a><br><img src="${attachment.url}" alt="Attachment Image"></div>`;
        }
        return `<div class="attachment"><a href="${attachment.url}" target="_blank">Download ${this.escapeHtml(attachment.name || 'attachment')}</a></div>`;
    }

    private static formatEmbed(embed: any): string {
        let embedHtml = '<div class="embed">';
        if (embed.title) {
            embedHtml += `<div class="embed-title">${this.escapeHtml(embed.title)}</div>`;
        }
        if (embed.description) {
            embedHtml += `<div class="embed-description">${this.escapeHtml(embed.description)}</div>`;
        }
        if (embed.footer?.text) {
            embedHtml += `<div class="embed-footer">${this.escapeHtml(embed.footer.text)}</div>`;
        }
        embedHtml += '</div>';
        return embedHtml;
    }

    private static escapeHtml(text: string): string {
        return text.replace(/[&<>"']/g, match => {
            switch (match) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#39;';
                default: return match;
            }
        });
    }
}

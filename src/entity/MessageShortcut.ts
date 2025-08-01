import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from "typeorm"

@Entity()
@Unique('key', ['guildId', 'shortcut'])
export class MessageShortcut {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    guildId: string

    @Column()
    message_guildId: string

    @Column()
    message_channelId: string

    @Column()
    message_messageId: string

    @Column()
    shortcut: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date
}

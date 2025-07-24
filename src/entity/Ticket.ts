import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity()
export class Ticket {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    channelId: string

    @Column({ nullable: true })
    forumPostId: string

    @Column()
    userOpen: string

    @Column({ nullable: true })
    userClose: string

    // 0 = Suggestion, 1 = Report, 2 = Content Creator, 3 = Other
    @Column()
    ticketType: number

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at'})
    updatedAt: Date;
}

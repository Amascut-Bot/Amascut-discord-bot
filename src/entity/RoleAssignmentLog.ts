import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm"

@Entity()
export class RoleAssignmentLog {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    targetUserId: string

    @Column()
    actorUserId: string

    @Column({ type: 'text', nullable: true })
    source: string | null

    @Column({ type: 'simple-json' })
    addedRoleIds: string[]

    @Column({ type: 'simple-json' })
    removedRoleIds: string[]

    @Column({ type: 'text', nullable: true })
    announcementChannelId: string | null

    @Column({ type: 'text', nullable: true })
    announcementMessageId: string | null

    @Column({ default: 'active' })
    status: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date
}
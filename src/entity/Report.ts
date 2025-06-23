import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class Report {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    reporter: string

    @Column()
    reportedUser: string

    @Column()
    role: string

    @Column({ nullable: true })
    link: string

    @Column({default: false})
    expired: boolean

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date;
}

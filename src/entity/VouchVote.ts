import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class VouchVote {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    vouchId: number

    @Column()
    voterId: string

    @Column()
    vote: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date
}
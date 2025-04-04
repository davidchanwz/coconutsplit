import { useState, useEffect } from 'react';
import { SupabaseService } from '../lib/supabase';
import { calculateEqualSplits, getTelegramUserId } from '../lib/utils';
import { User } from '../lib/types';

export function useExpense(groupId: string) {
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [members, setMembers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [paidBy, setPaidBy] = useState<string>("");
    const [splits, setSplits] = useState<{ [key: string]: string }>({});
    const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

    useEffect(() => {
        async function fetchData() {
            if (!groupId) return;

            try {
                const telegramUserId = getTelegramUserId();
                if (!telegramUserId) {
                    setError("Unable to identify user from Telegram");
                    setLoading(false);
                    return;
                }

                const userData = await SupabaseService.getUserByTelegramId(telegramUserId);
                if (!userData) {
                    setError("User not found. Please ensure you have joined the group.");
                    setLoading(false);
                    return;
                }
                setCurrentUser(userData);
                setPaidBy(userData.uuid);

                const membersData = await SupabaseService.getGroupMembers(groupId);
                const isMember = membersData.some(member => member.uuid === userData.uuid);
                if (!isMember) {
                    setError("You are not a member of this group.");
                    setLoading(false);
                    return;
                }

                setMembers(membersData);

                if (membersData.length > 0) {
                    const initialSplits: { [key: string]: string } = {};
                    membersData.forEach(member => {
                        initialSplits[member.uuid] = "";
                    });
                    setSplits(initialSplits);
                }
            } catch (err) {
                setError("Failed to load group data");
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [groupId]);

    useEffect(() => {
        if (members.length > 0) {
            setSelectedParticipants(members.map((member) => member.uuid));
        }
    }, [members]);

    useEffect(() => {
        if (members.length > 0 && amount && splitMode === "equal") {
            const amountValue = parseFloat(amount);
            if (!isNaN(amountValue)) {
                const participantsCount = selectedParticipants.length || 1;
                const equalSplits = calculateEqualSplits(amountValue, participantsCount);

                const newSplits = members.reduce((acc, member) => {
                    if (!selectedParticipants.includes(member.uuid)) {
                        acc[member.uuid] = "0.00";
                    } else {
                        const splitIndex = selectedParticipants.indexOf(member.uuid);
                        acc[member.uuid] = equalSplits[splitIndex].toFixed(2);
                    }
                    return acc;
                }, {} as Record<string, string>);

                setSplits(newSplits);
            }
        }
    }, [members, amount, splitMode, selectedParticipants]);

    const handleSplitModeChange = (mode: "equal" | "custom") => {
        setSplitMode(mode);
        if (mode === "equal" && amount && members.length > 0) {
            const amountValue = parseFloat(amount);
            if (!isNaN(amountValue)) {
                const splits = calculateEqualSplits(amountValue, members.length);
                const newSplits: { [key: string]: string } = {};
                members.forEach((member, index) => {
                    newSplits[member.uuid] = splits[index].toFixed(2);
                });
                setSplits(newSplits);
            }
        } else if (mode === "custom") {
            const newSplits: { [key: string]: string } = {};
            members.forEach(member => {
                newSplits[member.uuid] = "0.00";
            });
            setSplits(newSplits);
        }
    };

    const handleSplitChange = (userId: string, value: string) => {
        setSplits((prev) => ({
            ...prev,
            [userId]: value,
        }));
    };

    return {
        description,
        setDescription,
        amount,
        setAmount,
        members,
        currentUser,
        paidBy,
        setPaidBy,
        splits,
        setSplits,
        splitMode,
        setSplitMode,
        loading,
        submitting,
        setSubmitting,
        error,
        setError,
        handleSplitModeChange,
        selectedParticipants,
        setSelectedParticipants,
        handleSplitChange,
    };
}

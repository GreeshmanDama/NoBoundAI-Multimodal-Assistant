import api from "../../utils/axios"

export const getConversation = async () => {
    try {
        const {data} = await api.get("/api/chat/get-conversations")
        console.log("get conversations: ", data)
        return data;
    } catch (error) {
        console.log("error in get conversation: ", error);
        return []
    }
}
import api from "../../utils/axios"

const getCurrentUser = async () => {
    try {
        const { data } = await api.get("/api/me")
        console.log("data: ",data)
        return data;
    } catch (error) {
        console.log("error in get current users: ", error)
        return null;
    }
}

export default getCurrentUser
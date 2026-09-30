export const mockMenuItems = [
  {
    id: 1,
    name: "Margherita Pizza",
    description: "Fresh mozzarella, tomato sauce, basil, and olive oil",
    price: 18.99,
    category: "pizza",
    image: "https://via.placeholder.com/150",
    isFeatured: true
  },
  {
    id: 2,
    name: "Caesar Salad",
    description: "Romaine lettuce, parmesan cheese, croutons, caesar dressing",
    price: 12.99,
    category: "salads",
    image: "https://via.placeholder.com/150",
    isFeatured: true
  },
  {
    id: 3,
    name: "Grilled Salmon",
    description: "Fresh salmon with lemon butter sauce, served with vegetables",
    price: 24.99,
    category: "main",
    image: "https://via.placeholder.com/150",
    isFeatured: true
  },
  {
    id: 4,
    name: "Chocolate Cake",
    description: "Rich chocolate cake with ganache",
    price: 8.99,
    category: "desserts",
    image: "https://via.placeholder.com/150",
    isFeatured: false
  },
  {
    id: 5,
    name: "Spaghetti Carbonara",
    description: "Pasta with eggs, cheese, pancetta, and pepper",
    price: 16.99,
    category: "pasta",
    image: "https://via.placeholder.com/150",
    isFeatured: true
  },
  {
    id: 6,
    name: "Garlic Bread",
    description: "Toasted bread with garlic butter",
    price: 4.99,
    category: "appetizers",
    image: "https://via.placeholder.com/150",
    isFeatured: false
  }
];

export const categories = [
  { id: "all", name: "All", icon: "restaurant" },
  { id: "pizza", name: "Pizza", icon: "pizza" },
  { id: "pasta", name: "Pasta", icon: "restaurant" },
  { id: "salads", name: "Salads", icon: "leaf" },
  { id: "main", name: "Main Course", icon: "restaurant" },
  { id: "desserts", name: "Desserts", icon: "ice-cream" },
  { id: "appetizers", name: "Appetizers", icon: "fast-food" }
];

export const mockOrders = [
  {
    id: "ORD001",
    date: "2024-01-15",
    status: "delivered",
    total: 45.97,
    items: [
      { id: 1, name: "Margherita Pizza", quantity: 1, price: 18.99 },
      { id: 3, name: "Grilled Salmon", quantity: 1, price: 24.99 }
    ]
  },
  {
    id: "ORD002",
    date: "2024-01-20",
    status: "processing",
    total: 32.98,
    items: [
      { id: 2, name: "Caesar Salad", quantity: 2, price: 12.99 },
      { id: 6, name: "Garlic Bread", quantity: 1, price: 4.99 }
    ]
  }
];

export const mockBookings = [
  {
    id: "BK001",
    eventType: "Birthday Party",
    date: "2024-02-10",
    guests: 50,
    location: "Grand Hall",
    status: "confirmed",
    specialRequests: "Need vegetarian options"
  },
  {
    id: "BK002",
    eventType: "Corporate Event",
    date: "2024-02-25",
    guests: 100,
    location: "Conference Center",
    status: "pending",
    specialRequests: "Vegan options required"
  }
];

export const eventTypes = [
  { label: 'Wedding', value: 'wedding' },
  { label: 'Birthday Party', value: 'birthday' },
  { label: 'Corporate Event', value: 'corporate' },
  { label: 'Anniversary', value: 'anniversary' },
  { label: 'Graduation', value: 'graduation' },
  { label: 'Other', value: 'other' },
];
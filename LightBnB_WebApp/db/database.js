const properties = require("./json/properties.json");
const users = require("./json/users.json");


const { Pool } = require("pg");

const pool = new Pool({
  user: "development",
  password: "development",
  host: "localhost",
  database: "lightbnb",
});

// the following assumes that you named your connection variable `pool`
pool.query(`SELECT title FROM properties LIMIT 10;`).then(response => {

});

/// Users
//-----------------------------------------------------------------------------
/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {
  return pool
    .query(`SELECT * FROM users WHERE email = $1;`, [email.toLowerCase()])
    .then((res) => {
      return res.rows[0] || null;
    })
    .catch((err) => {
      console.error('Error fetching user email:', err);
      return null;
    });
};
// Original code
// let resolvedUser = null;
// for (const userId in users) {
//   const user = users[userId];
//   if (user && user.email.toLowerCase() === email.toLowerCase()) {
//     resolvedUser = user;
//   }
// }
// return Promise.resolve(resolvedUser);
//-----------------------------------------------------------------------------
/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  return pool
    .query(`SELECT * FROM users WHERE id = $1;`, [id])
    .then((res) => {
      return res.rows[0] || null;
    })
    .catch((err) => {
      console.error("Error fetching user by id:", err);
      return null;
    });
};


// Original code
// return Promise.resolve(users[id]);

//-----------------------------------------------------------------------------
/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function(user) {
  return pool
    .query(`INSERT INTO users(name, email, password) VALUES ($1, $2, $3) RETURNING *;`, [user.name, user.email, user.password])
    .then((res) => {
      return res.rows[0];
    })
    .catch((err) => {
      console.error(`There was an error adding user:`, err);
      return null;
    });
};



// Original code
// const userId = Object.keys(users).length + 1;
// user.id = userId;
// users[userId] = user;
// return Promise.resolve(user);

//-----------------------------------------------------------------------------
/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guest_id, limit = 10) {
  return pool
    .query(
      `SELECT reservations.id, properties.title, properties.cost_per_night, reservations.start_date, avg(property_reviews.rating) as average_rating
       FROM reservations
       JOIN properties ON reservations.property_id = properties.id
       JOIN property_reviews ON properties.id = property_reviews.property_id
       WHERE reservations.guest_id = $1
       GROUP BY properties.id, reservations.id
       ORDER BY reservations.start_date
       LIMIT $2;
      `, [guest_id, limit]
    )
    .then((res) => res.rows)
    .catch((err) => {
      console.error("There was an error while fetching reservations:", err);
      return [];
    });
};
//-----------------------------------------------------------------------------
/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function(options, limit = 10) {
  // 1. Initialize query parameters and where clause array
  const queryParams = [];
  const whereClauses = [];

  // 2. Start the query string
  let queryString = `
    SELECT properties.*, avg(property_reviews.rating) AS average_rating
    FROM properties
    LEFT JOIN property_reviews ON properties.id = property_reviews.property_id
  `;

  // 3. Add filters dynamically

  // City filter
  if (options.city) {
    queryParams.push(`%${options.city}%`);
    whereClauses.push(`city LIKE $${queryParams.length}`);
  }

  // Owner ID filter
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    whereClauses.push(`owner_id = $${queryParams.length}`);
  }

  // Price range filter (convert price to cents)
  if (options.minimum_price_per_night) {
    queryParams.push(options.minimum_price_per_night * 100); // In cents
    whereClauses.push(`cost_per_night >= $${queryParams.length}`);
  }

  if (options.maximum_price_per_night) {
    queryParams.push(options.maximum_price_per_night * 100); // In cents
    whereClauses.push(`cost_per_night <= $${queryParams.length}`);
  }

  // Apply whereClauses if any filters are provided
  if (whereClauses.length > 0) {
    queryString += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  // 4. Group by property ID to calculate the average rating
  queryString += ` GROUP BY properties.id`;

  // 5. Rating filter (if provided)
  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    queryString += ` HAVING avg(property_reviews.rating) >= $${queryParams.length}`;
  }

  // 6. Add the LIMIT clause
  queryParams.push(limit); // Limit the number of results
  queryString += `
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};
  `;

  // Debugging: log the query and params
  console.log(queryString, queryParams);

  // 7. Execute the query and return the results
  return pool.query(queryString, queryParams)
    .then((res) => res.rows)
    .catch((err) => {
      console.log(err.message); // Log errors
      return Promise.reject(err);
    });
};
//-----------------------------------------------------------------------------
/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  const queryString =
    `INSERT INTO properties
(owner_id, title, description, thumbnail_photo_url, cover_photo_url, cost_per_night, street, city, province, post_code, country, parking_spaces, number_of_bathrooms, number_of_bedrooms)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;
`;

  const queryParams = [
    property.owner_id,
    property.title,
    property.description,
    property.thumbnail_photo_url,
    property.cover_photo_url,
    property.cost_per_night * 100, // don't forget it converts to cents
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms
  ];

  return pool.query(queryString, queryParams)
    .then((res) => {
      return res.rows[0];
    })
    .catch((err) => {
      console.log("Error trying to add new property", err.message);
      return Promise.reject(err);
    });
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
  pool
};

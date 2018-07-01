'use strict'

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

function generateBlogPostData() {
    return {
        title: faker.lorem.sentence(),
        author: {
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName()    
        },
        content: faker.lorem.text()
    };
}

function seedBlogPostData() {
    console.info('seeding blog data');
    const seedData = [];
    for (let i=1; i<=10; i++) {
        seedData.push(generateBlogPostData());
    }
    return BlogPost.insertMany(seedData);
}


function tearDownDb() {
    return new Promise((resolve, reject) => {
    console.warn('Deleting database');
    mongoose.connection.dropDatabase()
        .then(result => resolve(result))
        .catch(err => reject(err));
    });
}

describe('Blog Posts API resource', function() {
    before(function() {
        return runServer(TEST_DATABASE_URL);
    });

    beforeEach(function() {
        return seedBlogPostData();
    });

    afterEach(function() {
        return tearDownDb();
    });

    after(function() {
        return closeServer();
    });

    describe('GET endpoint', function() {
        it('should return all existing blog posts', function() {
            let res;
            return chai.request(app)
                .get('/posts')
                .then(function (_res) {
                    res = _res;
                    res.should.have.status(200);
                    res.body.should.have.lengthOf.at.least(1);
                    return BlogPost.count();
                })
                .then(function (count) {
                    res.body.should.have.lengthOf(count);
                });
        });

        it('should return blogs with right fields', function () {
            let resPost;
            return chai.request(app)
                .get('/posts')
                .then(function (res) {

                    res.should.have.status(200);
                    res.should.be.json;
                    res.body.should.be.a('array');
                    res.body.should.have.lengthOf.at.least(1);

                    res.body.forEach(function (post) {
                        post.should.be.a('object');
                        post.should.include.keys('id', 'title', 'author', 'content', 'created');
                    });

                    resPost = res.body[0];
                    return BlogPost.findById(resPost.id);
                })
                .then(function (post) {
                    resPost.title.should.equal(post.title);
                    resPost.author.should.equal(post.authorName);
                    resPost.content.should.equal(post.content);
                });
        });
    });

    describe('POST endpoint', function() {
        it('should add a new blog post', function () {

            const newPost = generateBlogPostData()

            return chai.request(app)
                .post('/posts')
                .send(newPost)
                .then(function (res) {
                    res.should.have.status(201);
                    res.should.be.json;
                    res.body.should.be.a('object');
                    res.body.should.include.keys('id', 'title', 'author', 'content', 'created');
                    res.body.title.should.equal(newPost.title);
                    res.body.id.should.not.be.null;
                    res.body.author.should.equal(
                        `${newPost.author.firstName} ${newPost.author.lastName}`);
                    res.body.content.should.equal(newPost.content);
                    return BlogPost.findById(res.body.id);
                })
                .then(function (post) {
                    post.title.should.equal(newPost.title);
                    post.author.firstName.should.equal(newPost.author.firstName);
                    post.author.lastName.should.equal(newPost.author.lastName);
                    post.content.should.equal(newPost.content);
                });
        });
    });

    describe('PUT endpoint', function() {
        it('should update fields sent over', function () {
            const updateData = {
                title: 'Peter Pan Syndrome',
                content: 'The boy who never grew up',
                author: {
                    firstName: 'Jordan',
                    lastName: 'Shapiro'
                }
            };

            return BlogPost
                .findOne()
                .then(function (post) {
                    updateData.id = post.id;
                    
                    return chai.request(app)
                        .put(`/posts/${post.id}`)
                        .send(updateData);
                })
                .then(res => {
                    res.should.have.status(204);
                    return BlogPost.findById(updateData.id);
                })
                .then(post => {
                    post.title.should.equal(updateData.title);
                    post.content.should.equal(updateData.content);
                    post.author.firstName.should.equal(updateData.author.firstName);
                    post.author.lastName.should.equal(updateData.author.lastName);
                });
        });
    });

    describe('DELETE endpoint', function() {
        it('should delete a post by id', function () {
            let post;

            return BlogPost
                .findOne()
                .then(_post => {
                    post = _post;
                    return chai.request(app).delete(`/posts/${post.id}`);
                })
                .then(res => {
                    res.should.have.status(204);
                    return BlogPost.findById(post.id);
                })
                .then(_post => {
                    should.not.exist(_post);
                });
        });
    });
});
